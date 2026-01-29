from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .llm import chat_json, get_llm_config
from .enrichment import _build_pdf_excerpt  # keep PDF extraction behavior consistent

POLICY_ANALYSIS_PROMPT_VERSION = "1.1"


POLICY_ANALYSIS_PROMPT = """
Du er en analytiker med fokus på demokrati, digital suverænitet, borgerrettigheder og offentlig IT.

Analyser den følgende lov / lovforslag ud fra et menneske-, samfunds- og demokratiperspektiv.
Fokusér på konsekvenser, magtforskydninger og risici – ikke kun intentioner.

VIGTIGT:
- Dit svar skal være VALID JSON og KUN JSON.
- Ingen markdown, ingen forklaringstekst.
- Skriv på dansk.
- Hvis information mangler, skriv det eksplicit.

INPUT:
Titel: {title}
Resumé: {resume}
Lovtekst (PDF-uddrag, kan være afkortet): {law_text}

OUTPUTFORMAT (skal følges præcist):

{{
  "meta": {{
    "title": "",
    "jurisdiction": "",
    "law_type": "law|bill|regulation|directive|unknown",
    "analysis_timestamp_iso": ""
  }},

  "summary": {{
    "one_paragraph": "",
    "what_problem_it_addresses": "",
    "who_is_affected": {{
      "citizens": true,
      "public_sector": true,
      "private_companies": true
    }}
  }},

  "tags": [
    {{
      "tag": "",
      "category": "privatliv|demokrati|digital_suveraenitet|offentlig_it|sikkerhed|okonomi|adgang|AI|andet",
      "confidence": 0.0,
      "evidence": ""
    }}
  ],

  "attention_points": [
    {{
      "topic": "privatliv|demokrati|ejerskab|økonomi|sikkerhed|klima|adgang|AI|andet",
      "issue": "",
      "why_it_matters": "",
      "risk_level": "low|medium|high"
    }}
  ],

  "red_flags": [
    ""
  ],

  "positive_elements": [
    ""
  ],

  "open_questions": [
    ""
  ],

  "overall_assessment": {{
    "direction": "strengthens|weakens|mixed|neutral|unclear",
    "score": 0,
    "score_explanation": "",
    "who_benefits_most": "",
    "who_loses_most": ""
  }},

  "recommendation": {{
    "position": "support|support_with_changes|neutral|oppose|unclear",
    "rationale": "",
    "key_changes_if_any": [
      ""
    ]
  }}
}}
"""


def policy_analysis_enabled() -> bool:
    raw = os.getenv("ENRICH_POLICY_ANALYSIS", "").strip().lower()
    if not raw:
        return False
    return raw in {"1", "true", "yes", "y", "on"}


def policy_analysis_model_id() -> Optional[str]:
    cfg = get_llm_config()
    if not cfg:
        return None
    return f"{cfg.provider}:{cfg.model}"


def policy_analysis_prompt_version() -> str:
    return os.getenv("POLICY_ANALYSIS_PROMPT_VERSION", POLICY_ANALYSIS_PROMPT_VERSION)


def analyze_proposal_policy(proposal_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Returns:
        Parsed JSON object matching POLICY_ANALYSIS_PROMPT's schema, or None on failure.
    """
    title = (proposal_data.get("titel") or "").strip()
    resume = (proposal_data.get("resume") or "").strip() or "Ingen resumé tilgængelig"

    # Prefer already-extracted text (uploaded via browser) to avoid Cloudflare/WAF fetch issues.
    law_text = ""
    pdf_text_obj = proposal_data.get("pdfText")
    if isinstance(pdf_text_obj, dict):
        extracted = pdf_text_obj.get("extracted_text")
        if isinstance(extracted, str):
            law_text = extracted.strip()

    if not law_text:
        embedded = proposal_data.get("proposal_pdf_texts")
        if isinstance(embedded, list) and embedded:
            first = embedded[0]
            if isinstance(first, dict):
                extracted = first.get("extracted_text")
                if isinstance(extracted, str):
                    law_text = extracted.strip()

    # Final fallback: attempt remote PDF fetch (may fail) then fall back to resume.
    if not law_text:
        law_text = _build_pdf_excerpt(proposal_data).strip()
    if not law_text:
        law_text = resume

    prompt = POLICY_ANALYSIS_PROMPT.format(
        title=title,
        resume=resume,
        law_text=law_text or "Ingen lovtekst tilgængelig",
    )

    try:
        result = chat_json(
            [
                {
                    "role": "system",
                    "content": "Du svarer kun med valid JSON og følger det angivne outputformat.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=float(os.getenv("POLICY_ANALYSIS_TEMPERATURE", "0.3") or "0.3"),
            max_tokens=int(os.getenv("POLICY_ANALYSIS_MAX_TOKENS", "1400") or "1400"),
        )
    except Exception as e:
        print(f"Policy analysis failed: {e}")
        return None

    # Lightweight normalization/fill-ins to keep downstream parsing stable.
    meta = result.get("meta")
    if not isinstance(meta, dict):
        meta = {}
        result["meta"] = meta
    if not isinstance(meta.get("title"), str) or not meta.get("title"):
        meta["title"] = title
    if not isinstance(meta.get("analysis_timestamp_iso"), str) or not meta.get("analysis_timestamp_iso"):
        meta["analysis_timestamp_iso"] = datetime.now(timezone.utc).isoformat()

    if not isinstance(result.get("tags"), list):
        result["tags"] = []

    return result
