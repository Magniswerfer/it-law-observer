from __future__ import annotations

"""
Trial script: resolve + (optionally) persist PDF URLs for a single proposal/Sag id.

Run from `apps/api`:
  python3 -m src.examples.backfill_one_pdf --proposal-id 1189048 --dry-run
  python3 -m src.examples.backfill_one_pdf --proposal-id 1189048
"""

import argparse

from src.ingestion import IngestionService
from src.oda import fetch_pdf_urls_for_sag
from src.supabase_rest import fetch_proposal_by_id, update_proposal


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--proposal-id", type=int, required=True)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--force", action="store_true", help="Update even if pdfUrls already present")
    args = parser.parse_args()

    row = fetch_proposal_by_id(args.proposal_id)
    if not row:
        raise SystemExit(f"Proposal not found: {args.proposal_id}")

    raw_json = row.get("raw_json") or {}
    if not isinstance(raw_json, dict):
        raise SystemExit(f"Proposal {args.proposal_id} has non-object raw_json")

    existing_urls = raw_json.get("pdfUrls")
    existing_main = raw_json.get("mainPdfUrl")
    print(f"Before: mainPdfUrl={existing_main!r}, pdfUrls={len(existing_urls) if isinstance(existing_urls, list) else 0}")

    if not args.force and isinstance(existing_urls, list) and existing_urls:
        print("Skipping (already has pdfUrls). Use --force to re-resolve with current heuristic.")
        return

    service = IngestionService()
    result = fetch_pdf_urls_for_sag(
        service.client,
        {"id": args.proposal_id},
        delay_ms=service.doc_request_delay_ms,
        max_retries=service.doc_request_retries,
    )

    main_pdf_url = result.get("mainPdfUrl")
    pdf_urls = result.get("pdfUrls") or []
    print(f"Resolved: mainPdfUrl={main_pdf_url!r}, pdfUrls={len(pdf_urls)}")
    if pdf_urls:
        print(f"First PDF: {pdf_urls[0]}")

    if args.dry_run:
        return

    raw_json["mainPdfUrl"] = main_pdf_url
    raw_json["pdfUrls"] = pdf_urls
    raw_json["pdfDocuments"] = result.get("documents") or []
    update_proposal(args.proposal_id, {"raw_json": raw_json})
    print("Updated DB row.")


if __name__ == "__main__":
    main()

