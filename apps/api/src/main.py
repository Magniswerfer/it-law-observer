"""
FastAPI application for IT-politics bill radar.
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os

from .supabase_rest import fetch_proposals, fetch_proposal_by_id
from .schemas import ProposalWithLabel, IngestResponse, ProposalsQuery
from .ingestion import IngestionService

app = FastAPI(
    title="IT-Politics Bill Radar API",
    description="API for tracking Danish parliamentary proposals with IT relevance",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INGEST_TOKEN = os.getenv("INGEST_TOKEN")
if not INGEST_TOKEN:
    raise ValueError("INGEST_TOKEN environment variable is required")

@app.get("/")
def read_root():
    """Health check endpoint."""
    return {"status": "healthy", "service": "it-politics-bill-radar"}

@app.post("/ingest", response_model=IngestResponse)
def ingest_proposals(
    ingest_token: str = Query(..., description="Ingestion token for authentication")
):
    """
    Trigger ingestion of new proposals from Folketingets ODA API.

    This endpoint fetches proposals updated since the last ingestion run,
    upserts them into the database, and performs IT relevance analysis.
    """
    if ingest_token != INGEST_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid ingest token")

    try:
        service = IngestionService()
        result = service.run_ingestion()

        return IngestResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.get("/proposals", response_model=List[ProposalWithLabel])
def get_proposals(
    query: ProposalsQuery = Depends()
):
    """
    Get proposals with optional filtering.

    Query parameters:
    - type: Filter by proposal type ("L" for lovforslag, "B" for beslutningsforslag)
    - it_relevant: Filter by IT relevance (true/false)
    - topic: Filter by IT topic (searches in it_topics array)
    - limit: Maximum number of results (1-1000, default 50)
    - offset: Pagination offset (default 0)
    """
    try:
        if query.q:
            print(f"/proposals search q={query.q!r} offset={query.offset} limit={query.limit} topic={query.topic!r}")
        rows = fetch_proposals(
            {
                "type": query.type,
                "it_relevant": query.it_relevant,
                "topic": query.topic,
                "q": query.q,
                "limit": query.limit,
                "offset": query.offset,
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch proposals: {e}")

    results: List[ProposalWithLabel] = []
    for row in rows:
        label_data = row.pop("proposal_labels", None)
        if isinstance(label_data, list):
            label_data = label_data[0] if label_data else None
        row["label"] = label_data
        raw_json = row.get("raw_json") or {}
        if isinstance(raw_json, dict):
            main_pdf_url = raw_json.get("mainPdfUrl")
            row["mainPdfUrl"] = main_pdf_url if isinstance(main_pdf_url, str) else None
            pdf_urls = raw_json.get("pdfUrls")
            row["pdfUrls"] = [u for u in pdf_urls if isinstance(u, str)] if isinstance(pdf_urls, list) else []
        results.append(ProposalWithLabel(**row))

    return results

@app.get("/proposals/{proposal_id}", response_model=ProposalWithLabel)
def get_proposal(
    proposal_id: int
):
    """
    Get a specific proposal by ID with its IT analysis label.
    """
    try:
        row = fetch_proposal_by_id(proposal_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch proposal: {e}")

    if not row:
        raise HTTPException(status_code=404, detail="Proposal not found")

    label_data = row.pop("proposal_labels", None)
    if isinstance(label_data, list):
        label_data = label_data[0] if label_data else None
    row["label"] = label_data
    raw_json = row.get("raw_json") or {}
    if isinstance(raw_json, dict):
        main_pdf_url = raw_json.get("mainPdfUrl")
        row["mainPdfUrl"] = main_pdf_url if isinstance(main_pdf_url, str) else None
        pdf_urls = raw_json.get("pdfUrls")
        row["pdfUrls"] = [u for u in pdf_urls if isinstance(u, str)] if isinstance(pdf_urls, list) else []
    return ProposalWithLabel(**row)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
