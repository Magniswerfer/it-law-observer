from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .llm import chat_json, get_llm_config
from .enrichment import _build_pdf_excerpt  # keep PDF extraction behavior consistent

POLICY_ANALYSIS_PROMPT_VERSION = "2.0"


POLICY_ANALYSIS_PROMPT = """
Du er en analytiker med fokus på demokratisk kontrol, digital suverænitet, borgerrettigheder og offentlig IT.

Analyser den følgende lov / lovforslag med særligt fokus på IT-delen.
Formålet er ikke at vurdere om loven er “god eller dårlig” generelt, men at identificere:

- Hvor loven påvirker digital frihed, privatliv og demokrati
- Hvor der mangler eksplicit stillingtagen til IT-spørgsmål
- Hvilke KONKRETE ændringsforslag der bør stilles for at gøre lovens IT-del mere demokratisk, gennemsigtig og fri

VIGTIGT:
- Returnér KUN VALID JSON
- Ingen markdown eller forklarende tekst
- Skriv på dansk
- Hvis et punkt ikke er relevant for loven, marker det eksplicit som "not_applicable"
- Vær normativ og konkret: foreslå krav, ikke hensigtserklæringer

INPUT:
Titel: {title}
Resumé: {resume}
Lovtekst (PDF-uddrag, kan være afkortet): {law_text}

OUTPUTFORMAT (skal følges):

{{
  "meta": {{
    "title": "",
    "jurisdiction": "",
    "law_type": "law|bill|regulation|directive|unknown",
    "analysis_timestamp_iso": ""
  }},

  "short_summary": {{
    "what_the_law_does": "",
    "where_it_uses_or_depends_on_it": ""
  }},

  "democratic_it_concerns": [
    {{
      "topic": "open_source|privacy|surveillance|security|ownership|infrastructure|ai|access|procurement|other",
      "concern": "",
      "why_it_matters_democratically": "",
      "who_is_affected": ""
    }}
  ],

  "missing_positions": [
    {{
      "question": "",
      "why_this_should_be_explicit": ""
    }}
  ],

  "change_proposals": [
    {{
      "proposal": "",
      "what_it_requires": "",
      "democratic_effect": ""
    }}
  ],

  "public_control_and_responsibility": {{
    "who_owns_the_system": "",
    "who_operates_it": "",
    "who_maintains_it_long_term": "",
    "accountability_gaps": ""
  }},

  "privacy_and_freedom_assessment": {{
    "introduces_surveillance": "yes|no|unclear|not_applicable",
    "potential_privacy_issues": "",
    "groups_most_at_risk": ""
  }},

  "alignment_with_democratic_it_principles": {{
    "open_source_by_default": "aligned|not_aligned|unclear|not_applicable",
    "no_forced_digital_only_access": "aligned|not_aligned|unclear|not_applicable",
    "public_ownership_of_critical_systems": "aligned|not_aligned|unclear|not_applicable",
    "precaution_with_new_technology": "aligned|not_aligned|unclear|not_applicable"
  }},

  "final_note": {{
    "biggest_democratic_risk": "",
    "most_important_change": ""
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

    meta = result.get("meta")
    if not isinstance(meta, dict):
        meta = {}
        result["meta"] = meta
    if not isinstance(meta.get("title"), str) or not meta.get("title"):
        meta["title"] = title
    if not isinstance(meta.get("analysis_timestamp_iso"), str) or not meta.get("analysis_timestamp_iso"):
        meta["analysis_timestamp_iso"] = datetime.now(timezone.utc).isoformat()

    return result
