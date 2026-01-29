from __future__ import annotations

"""
Backfill script: resolve + persist PDF URLs for proposals already in Supabase.

Logs one line per updated proposal.

Run from `apps/api`:
  python3 -m src.examples.backfill_all_pdfs --limit 100 --offset 0
  python3 -m src.examples.backfill_all_pdfs --limit 100 --offset 0 --max-rows 500 --dry-run
  python3 -m src.examples.backfill_all_pdfs --force
"""

import argparse

from src.ingestion import IngestionService
from src.oda import fetch_pdf_urls_for_sag
from src.supabase_rest import fetch_proposals_page, update_proposal


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--offset", type=int, default=0, help="Only used with --use-offset-pagination")
    parser.add_argument(
        "--start-after-id",
        type=int,
        default=0,
        help="Keyset pagination start point (recommended for large tables)",
    )
    parser.add_argument(
        "--use-offset-pagination",
        action="store_true",
        help="Use offset/limit pagination instead of id-based keyset pagination",
    )
    parser.add_argument("--max-rows", type=int, default=0, help="0 means no limit")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Update even if pdfUrls already present (re-resolve with current heuristic)",
    )
    args = parser.parse_args()

    service = IngestionService()

    processed = 0
    updated = 0
    skipped = 0
    failed = 0

    offset = args.offset
    last_id = args.start_after_id
    max_rows = args.max_rows if args.max_rows > 0 else None

    while True:
        if max_rows is not None and processed >= max_rows:
            break

        if args.use_offset_pagination:
            page = fetch_proposals_page(select="id,raw_json", limit=args.limit, offset=offset, order="id.asc")
        else:
            page = fetch_proposals_page(
                select="id,raw_json",
                limit=args.limit,
                offset=0,
                order="id.asc",
                filters={"id": f"gt.{last_id}"},
            )
        if not page:
            break

        for row in page:
            if max_rows is not None and processed >= max_rows:
                break
            processed += 1

            proposal_id = row.get("id")
            raw_json = row.get("raw_json") or {}
            if not proposal_id or not isinstance(raw_json, dict):
                skipped += 1
                continue

            existing_urls = raw_json.get("pdfUrls")
            if not args.force and isinstance(existing_urls, list) and existing_urls:
                skipped += 1
                continue

            try:
                result = fetch_pdf_urls_for_sag(
                    service.client,
                    {"id": proposal_id},
                    delay_ms=service.doc_request_delay_ms,
                    max_retries=service.doc_request_retries,
                )
                main_pdf_url = result.get("mainPdfUrl")
                pdf_urls = result.get("pdfUrls") or []

                raw_json["mainPdfUrl"] = main_pdf_url
                raw_json["pdfUrls"] = pdf_urls
                raw_json["pdfDocuments"] = result.get("documents") or []

                if not args.dry_run:
                    update_proposal(proposal_id, {"raw_json": raw_json})

                updated += 1
                print(
                    f"UPDATED {proposal_id} | pdfs={len(pdf_urls)} | mainPdfUrl={main_pdf_url or ''}"
                )
            except Exception as e:
                failed += 1
                print(f"WARNING {proposal_id} | {e}")

        if args.use_offset_pagination:
            offset += args.limit
        else:
            last_id = max([r.get("id") for r in page if isinstance(r, dict) and isinstance(r.get("id"), int)], default=last_id)

    print(
        f"Done. processed={processed} updated={updated} skipped={skipped} failed={failed} dry_run={args.dry_run}"
    )


if __name__ == "__main__":
    main()
