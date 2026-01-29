from __future__ import annotations

"""
Debug helper: fetch PDF URLs for a single Sag id and print what ODA returned.

Run from `apps/api` (so imports resolve), e.g.:
  python -m src.examples.debug_pdf_for_sag 104068
"""

import sys

from src.ingestion import IngestionService
from src.oda import fetch_pdf_urls_for_sag


def main(argv: list[str]) -> None:
    if len(argv) != 2 or not argv[1].isdigit():
        raise SystemExit("Usage: python -m src.examples.debug_pdf_for_sag <sag_id>")

    sag_id = int(argv[1])
    service = IngestionService()
    pdf_result = fetch_pdf_urls_for_sag(service.client, {"id": sag_id})
    print(f"sagId={pdf_result.get('sagId')}")
    print(f"mainPdfUrl={pdf_result.get('mainPdfUrl')}")
    print(f"pdfUrls={pdf_result.get('pdfUrls')}")
    print("documents=")
    for doc in pdf_result.get("documents") or []:
        print(doc)


if __name__ == "__main__":
    main(sys.argv)
