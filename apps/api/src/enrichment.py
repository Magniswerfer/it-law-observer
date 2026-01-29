"""
Enrichment module for IT analysis using LLM.
Only runs when OPENAI_API_KEY is configured.
"""

import json
import os
from typing import Dict, Any, Optional
import openai
from datetime import datetime
from .supabase_rest import upsert_proposal_label

# Check if OpenAI API key is available
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if OPENAI_API_KEY:
    openai.api_key = OPENAI_API_KEY

ENRICHMENT_PROMPT_VERSION = "1.0"

ENRICHMENT_PROMPT = """
Du er en ekspert i dansk IT-politik og skal analysere et lovforslag eller beslutningsforslag fra Folketinget.

Analyser følgende forslag og giv en vurdering af dets IT-relevans:

Titel: {title}
Resume: {resume}

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

def enrich_proposal(proposal_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Enrich a proposal with IT analysis using LLM.

    Args:
        proposal_data: Dictionary containing proposal data

    Returns:
        Dict with enrichment results or None if enrichment fails
    """
    if not OPENAI_API_KEY:
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

        prompt = ENRICHMENT_PROMPT.format(
            title=title,
            resume=resume or "Ingen resume tilgængelig"
        )

        response = openai.ChatCompletion.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": "Du er en ekspert i dansk IT-politik. Svar kun med valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )

        # Parse JSON response
        content = response.choices[0].message.content.strip()
        result = json.loads(content)

        # Validate required fields
        if not isinstance(result.get('it_relevant'), bool):
            raise ValueError("Invalid it_relevant field")

        return {
            "it_relevant": result["it_relevant"],
            "it_topics": result.get("it_topics", []),
            "it_summary_da": result.get("it_summary_da"),
            "why_it_relevant_da": result.get("why_it_relevant_da"),
            "confidence": 0.9,  # High confidence for LLM results
            "model": "gpt-4",
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
