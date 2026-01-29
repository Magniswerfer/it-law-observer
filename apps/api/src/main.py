"""
FastAPI application for IT-politics bill radar.
"""

from .config import load_env

load_env()

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi import UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List
import os
import hashlib
from datetime import datetime, timezone

from .supabase_rest import fetch_proposals, fetch_proposal_by_id, upsert_proposal_pdf_text, upsert_proposal_policy_analysis
from .schemas import ProposalWithLabel, IngestResponse, ProposalsQuery
from .ingestion import IngestionService
from .pdf_text import extract_text_from_pdf_bytes
from .policy_analysis import analyze_proposal_policy, policy_analysis_model_id, policy_analysis_prompt_version
from .auth import require_admin

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

@app.post("/admin/ingest", response_model=IngestResponse)
async def admin_ingest_proposals(
    _user=Depends(require_admin),
):
    """
    Trigger ingestion using Supabase Auth (admin) instead of INGEST_TOKEN.
    """
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
        needs_admin_flags = any(
            v is not None
            for v in (query.has_pdf_link, query.has_pdf_text, query.has_policy_analysis)
        )

        def row_to_result(row: dict) -> ProposalWithLabel:
            label_data = row.pop("proposal_labels", None)
            if isinstance(label_data, list):
                label_data = label_data[0] if label_data else None
            row["label"] = label_data

            policy_data = row.pop("proposal_policy_analyses", None)
            if isinstance(policy_data, list):
                policy_data = policy_data[0] if policy_data else None
            row["policy"] = policy_data

            pdf_text_data = row.pop("proposal_pdf_texts", None)
            if isinstance(pdf_text_data, list):
                pdf_text_data = pdf_text_data[0] if pdf_text_data else None
            row["pdfText"] = pdf_text_data

            raw_json = row.get("raw_json") or {}
            if isinstance(raw_json, dict):
                main_pdf_url = raw_json.get("mainPdfUrl")
                row["mainPdfUrl"] = main_pdf_url if isinstance(main_pdf_url, str) else None
                pdf_urls = raw_json.get("pdfUrls")
                row["pdfUrls"] = [u for u in pdf_urls if isinstance(u, str)] if isinstance(pdf_urls, list) else []

            return ProposalWithLabel(**row)

        def extract_policy_tags(result: ProposalWithLabel) -> List[str]:
            policy = result.policy
            if not policy or not isinstance(policy.analysis, dict):
                return []
            tags: List[str] = []
            raw_tags = policy.analysis.get("tags")
            if isinstance(raw_tags, list):
                for item in raw_tags:
                    if isinstance(item, str):
                        tags.append(item)
                    elif isinstance(item, dict):
                        tag = item.get("tag")
                        if isinstance(tag, str):
                            tags.append(tag)

            if not tags:
                raw_concerns = policy.analysis.get("democratic_it_concerns")
                if isinstance(raw_concerns, list):
                    for item in raw_concerns:
                        if isinstance(item, str):
                            tags.append(item)
                        elif isinstance(item, dict):
                            topic = item.get("topic")
                            if isinstance(topic, str):
                                tags.append(topic)
            return [t.strip() for t in tags if isinstance(t, str) and t.strip() and t.strip().lower() != "not_applicable"]

        def merged_tags(result: ProposalWithLabel) -> List[str]:
            tags: List[str] = []
            if result.label and isinstance(result.label.it_topics, list):
                tags.extend(result.label.it_topics)
            tags.extend(extract_policy_tags(result))
            seen = set()
            out: List[str] = []
            for tag in tags:
                cleaned = tag.strip()
                if not cleaned:
                    continue
                key = cleaned.lower()
                if key in seen:
                    continue
                seen.add(key)
                out.append(cleaned)
            return out

        def matches_topic(result: ProposalWithLabel) -> bool:
            if not query.topic:
                return True
            needle = query.topic.strip().lower()
            if not needle:
                return True
            return any(tag.lower() == needle for tag in merged_tags(result))

        def matches_flags(result: ProposalWithLabel) -> bool:
            has_pdf_link = bool(result.mainPdfUrl or (result.pdfUrls or []))
            pdf_text = result.pdfText
            has_pdf_text = bool(pdf_text and pdf_text.extracted_text and not pdf_text.error)
            has_policy = bool(result.policy and result.policy.analysis)

            if query.has_pdf_link is not None and has_pdf_link != query.has_pdf_link:
                return False
            if query.has_pdf_text is not None and has_pdf_text != query.has_pdf_text:
                return False
            if query.has_policy_analysis is not None and has_policy != query.has_policy_analysis:
                return False
            return True

        needs_topic_merge = bool(query.topic)
        if not needs_admin_flags and not needs_topic_merge:
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
            return [row_to_result(r) for r in rows]

        # Server-side flag/topic filtering with stable paging:
        # We scan the ordered proposals and apply the filters in Python so the `offset`
        # is interpreted on the filtered result set.
        batch_size = min(500, max(100, query.limit * 5))
        scanned_offset = 0
        skipped = 0
        out: List[ProposalWithLabel] = []

        while len(out) < query.limit:
            batch = fetch_proposals(
                {
                    "type": query.type,
                    "it_relevant": query.it_relevant,
                    "topic": None if needs_topic_merge else query.topic,
                    "q": query.q,
                    "limit": batch_size,
                    "offset": scanned_offset,
                }
            )
            if not batch:
                break

            scanned_offset += len(batch)
            for raw in batch:
                result = row_to_result(raw)
                if not matches_flags(result):
                    continue
                if not matches_topic(result):
                    continue
                if skipped < query.offset:
                    skipped += 1
                    continue
                out.append(result)
                if len(out) >= query.limit:
                    break

            # Safety valve: avoid scanning forever if something goes wrong.
            if scanned_offset > 20000:
                break

        return out
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch proposals: {e}")

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
    policy_data = row.pop("proposal_policy_analyses", None)
    if isinstance(policy_data, list):
        policy_data = policy_data[0] if policy_data else None
    row["policy"] = policy_data
    pdf_text_data = row.pop("proposal_pdf_texts", None)
    if isinstance(pdf_text_data, list):
        pdf_text_data = pdf_text_data[0] if pdf_text_data else None
    row["pdfText"] = pdf_text_data
    raw_json = row.get("raw_json") or {}
    if isinstance(raw_json, dict):
        main_pdf_url = raw_json.get("mainPdfUrl")
        row["mainPdfUrl"] = main_pdf_url if isinstance(main_pdf_url, str) else None
        pdf_urls = raw_json.get("pdfUrls")
        row["pdfUrls"] = [u for u in pdf_urls if isinstance(u, str)] if isinstance(pdf_urls, list) else []
    return ProposalWithLabel(**row)


@app.post("/proposals/{proposal_id}/pdf-text")
async def upload_proposal_pdf_text(
    proposal_id: int,
    _user=Depends(require_admin),
    file: UploadFile = File(..., description="PDF file"),
    source_url: str = Form("", description="Original PDF URL (optional)"),
    run_policy_analysis: bool = Form(True, description="Run policy analysis after extracting text"),
):
    """
    Upload a PDF from the user's browser (to bypass Cloudflare/WAF blocks on the backend),
    extract text server-side, store it, and optionally run the policy-analysis prompt.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only .pdf files are supported")

    max_mb = int(os.getenv("PDF_UPLOAD_MAX_MB", "25") or "25")
    max_bytes = max_mb * 1024 * 1024
    content = await file.read()
    if len(content) > max_bytes:
        raise HTTPException(status_code=413, detail=f"PDF too large (max {max_mb}MB)")

    sha = hashlib.sha256(content).hexdigest()

    try:
        max_pages = int(os.getenv("ENRICH_PDF_MAX_PAGES", "25") or "25")
        extracted = extract_text_from_pdf_bytes(content, max_pages=max_pages)
        if not extracted.strip():
            raise ValueError("No extractable text found (scanned PDF?)")
    except Exception as e:
        upsert_proposal_pdf_text(
            {
                "proposal_id": proposal_id,
                "source_url": source_url or None,
                "sha256": sha,
                "extracted_text": "",
                "extracted_at": datetime.now(timezone.utc).isoformat(),
                "error": str(e),
            }
        )
        raise HTTPException(status_code=422, detail=f"Failed to extract PDF text: {e}")

    # Store extracted text (truncate if desired)
    max_chars = int(os.getenv("PDF_TEXT_MAX_CHARS", "200000") or "200000")
    if len(extracted) > max_chars:
        extracted = extracted[:max_chars] + "\n\n[... afkortet ...]"

    pdf_row = upsert_proposal_pdf_text(
        {
            "proposal_id": proposal_id,
            "source_url": source_url or None,
            "sha256": sha,
            "extracted_text": extracted,
            "extracted_at": datetime.now(timezone.utc).isoformat(),
            "error": None,
        }
    )

    analysis_row = None
    policy_error = None
    if run_policy_analysis and os.getenv("ENRICH_POLICY_ANALYSIS", "").strip().lower() in {"1", "true", "yes", "y", "on"}:
        proposal = fetch_proposal_by_id(proposal_id)
        if proposal:
            # Attach extracted text so analysis can use it without fetching remote PDFs.
            proposal["pdfText"] = pdf_row
            analysis = analyze_proposal_policy(proposal)
            if analysis is not None:
                analysis_row = upsert_proposal_policy_analysis(
                    {
                        "proposal_id": proposal_id,
                        "analysis": analysis,
                        "model": policy_analysis_model_id(),
                        "prompt_version": policy_analysis_prompt_version(),
                    }
                )
            else:
                policy_error = "Policy analysis failed (see backend logs for details)."
        else:
            policy_error = "Proposal not found after upload; policy analysis not run."

    return {"proposal_id": proposal_id, "pdfText": pdf_row, "policy": analysis_row, "policyError": policy_error}


@app.post("/proposals/{proposal_id}/policy-analysis")
def run_policy_analysis(proposal_id: int, _user=Depends(require_admin)):
    """
    Re-run policy analysis for a proposal using already-stored PDF text (if present).
    """
    if os.getenv("ENRICH_POLICY_ANALYSIS", "").strip().lower() not in {"1", "true", "yes", "y", "on"}:
        raise HTTPException(status_code=400, detail="ENRICH_POLICY_ANALYSIS is not enabled")

    proposal = fetch_proposal_by_id(proposal_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    analysis = analyze_proposal_policy(proposal)
    if analysis is None:
        raise HTTPException(status_code=502, detail="Policy analysis failed (see backend logs)")

    row = upsert_proposal_policy_analysis(
        {
            "proposal_id": proposal_id,
            "analysis": analysis,
            "model": policy_analysis_model_id(),
            "prompt_version": policy_analysis_prompt_version(),
        }
    )
    return {"proposal_id": proposal_id, "policy": row}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
