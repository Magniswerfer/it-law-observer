"""
Enrichment module for IT analysis using LLM.
Runs when an LLM provider is configured (GROQ_API_KEY or OPENAI_API_KEY).
"""

import os
from typing import Dict, Any, Optional, Tuple
from .supabase_rest import upsert_proposal_label
from .llm import chat_json, llm_enabled, allow_network_pdf_fetch, get_llm_config

ENRICHMENT_PROMPT_VERSION = "1.1"

ENRICHMENT_PROMPT = """
Du er en ekspert i dansk IT-politik og skal analysere et lovforslag eller beslutningsforslag fra Folketinget.

Analyser følgende forslag og giv en vurdering af dets IT-relevans:

Titel: {title}
Resume: {resume}
PDF-uddrag (kan være afkortet): {pdf_excerpt}

Besvar følgende på dansk:
1. Er forslaget IT-relevant? (ja/nej)
2. Hvis ja, hvilke IT-emner dækker det? (kommasepareret liste)
3. Giv en kort opsummering af forslagets IT-aspekter (max 200 ord)
4. Forklar hvorfor forslaget er IT-relevant (max 300 ord)

Svar i følgende JSON format:
{{
    "it_relevant": true/false,
    "it_topics": ["emne1", "emne2"],
    "it_summary_da": "kort opsummering på dansk",
    "why_it_relevant_da": "forklaring på dansk"
}}
"""

def _extract_pdf_urls(proposal_data: Dict[str, Any]) -> Tuple[Optional[str], list[str]]:
    # Prefer PDFs directly attached to the Sag dict during ingestion.
    main = proposal_data.get("mainPdfUrl")
    main_pdf_url = main if isinstance(main, str) and main.strip() else None
    pdf_urls_value = proposal_data.get("pdfUrls")
    pdf_urls = [u for u in pdf_urls_value if isinstance(u, str) and u.strip()] if isinstance(pdf_urls_value, list) else []

    if main_pdf_url or pdf_urls:
        return main_pdf_url, pdf_urls

    # Fallback to PDFs stored under `raw_json` when enriching DB rows.
    raw_json = proposal_data.get("raw_json") or {}
    if not isinstance(raw_json, dict):
        raw_json = {}
    main = raw_json.get("mainPdfUrl")
    main_pdf_url = main if isinstance(main, str) and main.strip() else None
    pdf_urls_value = raw_json.get("pdfUrls")
    pdf_urls = [u for u in pdf_urls_value if isinstance(u, str) and u.strip()] if isinstance(pdf_urls_value, list) else []
    return main_pdf_url, pdf_urls


def _build_pdf_excerpt(proposal_data: Dict[str, Any]) -> str:
    """
    Best-effort PDF text extraction for enrichment context.
    Never raises (returns an empty string on failure).
    """
    if not allow_network_pdf_fetch():
        return ""

    main_pdf_url, pdf_urls = _extract_pdf_urls(proposal_data)
    url = main_pdf_url or (pdf_urls[0] if pdf_urls else None)
    if not url:
        return ""

    try:
        from .pdf_text import extract_text_from_pdf_url

        max_pages = int(os.getenv("ENRICH_PDF_MAX_PAGES", "25") or "25")
        max_chars = int(os.getenv("ENRICH_PDF_MAX_CHARS", "40000") or "40000")
        text = extract_text_from_pdf_url(url, max_pages=max_pages)
        if len(text) > max_chars:
            return text[:max_chars] + "\n\n[... afkortet ...]"
        return text
    except Exception as e:
        print(f"PDF text extraction failed: {e}")
        return ""


def enrich_proposal(proposal_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Enrich a proposal with IT analysis using LLM.

    Args:
        proposal_data: Dictionary containing proposal data

    Returns:
        Dict with enrichment results or None if enrichment fails
    """
    if not llm_enabled():
        # Return basic enrichment based on keyword matching
        from .it_relevance import is_it_relevant, extract_it_topics

        title = proposal_data.get('titel', '')
        resume = proposal_data.get('resume', '')

        text_to_analyze = f"{title} {resume}"
        it_relevant = is_it_relevant(text_to_analyze)
        it_topics = extract_it_topics(text_to_analyze)

        return {
            "it_relevant": it_relevant,
            "it_topics": it_topics,
            "confidence": 0.7 if it_relevant else 0.3,
            "model": "keyword-matching",
            "prompt_version": ENRICHMENT_PROMPT_VERSION
        }

    try:
        # Use LLM for enrichment
        title = proposal_data.get('titel', '')
        resume = proposal_data.get('resume', '')
        pdf_excerpt = _build_pdf_excerpt(proposal_data)

        prompt = ENRICHMENT_PROMPT.format(
            title=title,
            resume=resume or "Ingen resume tilgængelig",
            pdf_excerpt=pdf_excerpt or "Ingen PDF-tekst tilgængelig"
        )

        result = chat_json(
            [
                {"role": "system", "content": "Du er en ekspert i dansk IT-politik. Svar kun med valid JSON."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
            max_tokens=1200,
        )

        # Validate required fields
        if not isinstance(result.get('it_relevant'), bool):
            raise ValueError("Invalid it_relevant field")

        return {
            "it_relevant": result["it_relevant"],
            "it_topics": result.get("it_topics", []),
            "it_summary_da": result.get("it_summary_da"),
            "why_it_relevant_da": result.get("why_it_relevant_da"),
            "confidence": 0.9,  # High confidence for LLM results
            "model": (
                f"{cfg.provider}:{cfg.model}"
                if (cfg := get_llm_config())
                else "llm"
            ),
            "prompt_version": ENRICHMENT_PROMPT_VERSION
        }

    except Exception as e:
        print(f"LLM enrichment failed: {e}")
        # Fallback to keyword matching
        from .it_relevance import is_it_relevant, extract_it_topics

        title = proposal_data.get('titel', '')
        resume = proposal_data.get('resume', '')

        text_to_analyze = f"{title} {resume}"
        it_relevant = is_it_relevant(text_to_analyze)
        it_topics = extract_it_topics(text_to_analyze)

        return {
            "it_relevant": it_relevant,
            "it_topics": it_topics,
            "confidence": 0.5,  # Lower confidence due to fallback
            "model": "keyword-matching-fallback",
            "prompt_version": ENRICHMENT_PROMPT_VERSION
        }

def should_enrich_proposal(proposal_data: Dict[str, Any]) -> bool:
    """
    Determine if a proposal should be enriched based on IT relevance heuristic.

    Args:
        proposal_data: Dictionary containing proposal data

    Returns:
        bool: True if proposal should be queued for enrichment
    """
    from .it_relevance import is_it_relevant

    title = proposal_data.get('titel', '')
    resume = proposal_data.get('resume', '')

    text_to_analyze = f"{title} {resume}"
    return is_it_relevant(text_to_analyze)

def create_or_update_label(proposal_id: int, enrichment_result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create or update a proposal label in the database.

    Args:
        db: Database session
        proposal_id: ID of the proposal
        enrichment_result: Enrichment result data

    Returns:
        ProposalLabel: Created or updated label
    """
    payload = {
        "proposal_id": proposal_id,
        **enrichment_result
    }

    return upsert_proposal_label(payload)
