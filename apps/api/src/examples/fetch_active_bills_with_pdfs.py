from __future__ import annotations

"""
Small example: fetch all active bills (Sag typeid=3) enriched with PDF URLs.

Run from `apps/api` (so imports resolve), e.g.:
  python -m src.examples.fetch_active_bills_with_pdfs
"""

from src.ingestion import IngestionService


def main() -> None:
    service = IngestionService(only_in_process=True)
    bills = service.fetch_active_bills_with_pdfs()

    for bill in bills:
        sag_id = bill.get("id")
        title = (bill.get("titel") or bill.get("titelkort") or "").strip()
        main_pdf = bill.get("mainPdfUrl") or ""
        print(f"{sag_id} | {title} | {main_pdf}")


if __name__ == "__main__":
    main()
