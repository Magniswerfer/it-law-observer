from __future__ import annotations

"""
Backfill helper: run policy/democracy analysis for proposals already stored in Supabase.

Run from `apps/api` (so imports resolve), e.g.:
  python -m src.examples.backfill_policy_analysis --max-rows 50

Notes:
  - Requires SUPABASE_URL + SUPABASE_SECRET_KEY and an LLM provider key (GROQ_API_KEY or OPENAI_API_KEY).
  - If you want PDF law-text context, ensure PDFs are present in `raw_json` (see backfill_one_pdf.py / backfill_all_pdfs.py)
    and keep ENRICH_FETCH_PDFS=true.
"""

import argparse

from src.policy_analysis import analyze_proposal_policy, policy_analysis_model_id, policy_analysis_prompt_version
from src.supabase_rest import fetch_proposals_page, upsert_proposal_policy_analysis


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=25)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--max-rows", type=int, default=200)
    parser.add_argument("--rewrite-existing", action="store_true", default=False)
    args = parser.parse_args()

    processed = 0
    updated = 0
    skipped = 0

    offset = args.offset
    while processed < args.max_rows:
        page = fetch_proposals_page(
            select="id,titel,resume,raw_json,proposal_policy_analyses(proposal_id)",
            limit=args.limit,
            offset=offset,
            order="id.asc",
        )
        if not page:
            break

        for row in page:
            if processed >= args.max_rows:
                break
            processed += 1

            proposal_id = row.get("id")
            if not isinstance(proposal_id, int):
                skipped += 1
                continue

            existing = row.get("proposal_policy_analyses")
            if (not args.rewrite_existing) and isinstance(existing, list) and existing:
                skipped += 1
                continue

            analysis = analyze_proposal_policy(row)
            if analysis is None:
                skipped += 1
                continue

            upsert_proposal_policy_analysis(
                {
                    "proposal_id": proposal_id,
                    "analysis": analysis,
                    "model": policy_analysis_model_id(),
                    "prompt_version": policy_analysis_prompt_version(),
                }
            )
            updated += 1
            print(f"Updated policy analysis for proposal_id={proposal_id}")

        offset += args.limit

    print({"processed": processed, "updated": updated, "skipped": skipped})


if __name__ == "__main__":
    main()
