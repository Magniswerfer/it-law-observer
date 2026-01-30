from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from .llm import chat_json_schema, get_llm_config
from .enrichment import _build_pdf_excerpt  # keep PDF extraction behavior consistent

POLICY_ANALYSIS_PROMPT_VERSION = "3.1"


POLICY_ANALYSIS_PROMPT = """
Du er en analytiker med fokus på demokratisk kontrol, digital suverænitet, borgerrettigheder og offentlig IT.

Opgave:
Gennemgå loven med fokus på IT, også når IT kun er implicit (fx registre, GIS/kort, sensorer, logning, sagsbehandling, dataudveksling, dokumentarkiver, tilsyn, drift).

Målet er at producere KONKRETE ændringskrav og spørgsmål, der gør lovens IT-del:
- mere demokratisk kontrollerbar
- mere gennemsigtig
- mere privatlivs- og sikkerhedsrobust
- mere fri (åbne standarder, open source hvor relevant, undgå lock-in)

VIGTIGT:
- Returnér KUN VALID JSON (ingen markdown)
- Skriv på dansk
- Udfyld ALLE felter
- Brug aldrig "not_applicable". Hvis loven ikke siger noget, skriv "ikke eksplicit nævnt; bør afklares" og lav et ændringskrav/spørgsmål.
- Vær konkret: skriv krav, ikke værdier.
- Sørg for at besvare disse faste spørgsmål under "questions_to_ask" (formuler dem som spørgsmål og begrund kort hvorfor): 
  1) Er løsningen åben og gennemsigtig?
  2) Ejes data af kommunen eller en privat leverandør?
  3) Gavner det den lokale økonomi – eller store techkoncerner?
  4) Er der taget højde for sikkerhed, etik og borgernes ret til privatliv?

INPUT:
Titel: {title}
Resumé: {resume}
Lovtekst (PDF-uddrag, kan være afkortet): {law_text}

OUTPUT (præcis dette JSON-format):

{{
  "meta": {{
    "title": "",
    "jurisdiction": "",
    "law_type": "law|bill|regulation|directive|unknown",
    "analysis_timestamp_iso": ""
  }},

  "summary": {{
    "one_paragraph": "",
    "what_changes_in_practice": ""
  }},

  "it_hooks": [
    {{
      "hook": "",
      "why_it_implies_it_systems_or_data": "",
      "likely_data_types": ["", ""],
      "who_might_run_it": "uklart; bør afklares",
      "privacy_or_security_surface": ""
    }}
  ],

  "democratic_change_requests": [
    {{
      "request": "",
      "rationale": "",
      "targets_hook_index": 0,
      "implementation_hint": ""
    }}
  ],

  "questions_to_ask": [
    {{
      "question": "",
      "why_it_matters": ""
    }}
  ],

  "amendment_text_suggestions": [
    {{
      "short_clause": "",
      "where_to_insert": ""
    }}
  ],

  "top_risks_if_unchanged": [
    ""
  ],

  "positive_elements_to_keep": [
    ""
  ]
}}
"""

POLICY_ANALYSIS_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "meta": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {"type": "string"},
                "jurisdiction": {"type": "string"},
                "law_type": {
                    "type": "string",
                    "enum": ["law", "bill", "regulation", "directive", "unknown"],
                },
                "analysis_timestamp_iso": {"type": "string"},
            },
            "required": ["title", "jurisdiction", "law_type", "analysis_timestamp_iso"],
        },
        "summary": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "one_paragraph": {"type": "string"},
                "what_changes_in_practice": {"type": "string"},
            },
            "required": ["one_paragraph", "what_changes_in_practice"],
        },
        "it_hooks": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "hook": {"type": "string"},
                    "why_it_implies_it_systems_or_data": {"type": "string"},
                    "likely_data_types": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "who_might_run_it": {"type": "string"},
                    "privacy_or_security_surface": {"type": "string"},
                },
                "required": [
                    "hook",
                    "why_it_implies_it_systems_or_data",
                    "likely_data_types",
                    "who_might_run_it",
                    "privacy_or_security_surface",
                ],
            },
        },
        "democratic_change_requests": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "request": {"type": "string"},
                    "rationale": {"type": "string"},
                    "targets_hook_index": {"type": "integer", "minimum": 0},
                    "implementation_hint": {"type": "string"},
                },
                "required": ["request", "rationale", "targets_hook_index", "implementation_hint"],
            },
        },
        "questions_to_ask": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "question": {"type": "string"},
                    "why_it_matters": {"type": "string"},
                },
                "required": ["question", "why_it_matters"],
            },
        },
        "amendment_text_suggestions": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "short_clause": {"type": "string"},
                    "where_to_insert": {"type": "string"},
                },
                "required": ["short_clause", "where_to_insert"],
            },
        },
        "top_risks_if_unchanged": {"type": "array", "items": {"type": "string"}},
        "positive_elements_to_keep": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "meta",
        "summary",
        "it_hooks",
        "democratic_change_requests",
        "questions_to_ask",
        "amendment_text_suggestions",
        "top_risks_if_unchanged",
        "positive_elements_to_keep",
    ],
}


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
        result = chat_json_schema(
            [
                {
                    "role": "system",
                    "content": "Du svarer kun med valid JSON og følger det angivne outputformat.",
                },
                {"role": "user", "content": prompt},
            ],
            schema=POLICY_ANALYSIS_SCHEMA,
            schema_name="policy_analysis_v3",
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
    meta["analysis_timestamp_iso"] = datetime.now(timezone.utc).isoformat()

    return result
