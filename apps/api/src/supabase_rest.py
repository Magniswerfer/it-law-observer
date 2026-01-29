import os
from typing import Any, Dict, List, Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SECRET_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_ANON_KEY")
)

if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY) are required")

BASE_URL = f"{SUPABASE_URL}/rest/v1"

_headers = {
    "apikey": SUPABASE_SECRET_KEY,
    "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    "Content-Type": "application/json",
}

_client = httpx.Client(timeout=30.0, headers=_headers)


def _request(method: str, path: str, params: Optional[Dict[str, Any]] = None, json: Any = None, headers: Optional[Dict[str, str]] = None):
    url = f"{BASE_URL}/{path}"
    response = _client.request(method, url, params=params, json=json, headers=headers)
    if response.status_code >= 400:
        raise Exception(f"Supabase REST error {response.status_code}: {response.text}")
    if response.text:
        return response.json()
    return None


def fetch_proposals(query: Dict[str, Any]) -> List[Dict[str, Any]]:
    select_clause = "*,proposal_labels(*)"
    params: Dict[str, Any] = {
        "select": select_clause,
        "order": "opdateringsdato.desc",
        "limit": query["limit"],
        "offset": query["offset"],
    }

    if query.get("type"):
        params["nummerprefix"] = f"eq.{query['type']}"

    q = (query.get("q") or "").strip()
    is_id_lookup = q.isdigit()

    # If we're searching by exact ID, do not force an inner join on labels.
    # Otherwise, unlabeled proposals would never show up (even if the ID exists).
    if (query.get("it_relevant") is not None or query.get("topic")) and not is_id_lookup:
        params["select"] = "*,proposal_labels!inner(*)"

    if query.get("it_relevant") is not None and not is_id_lookup:
        params["proposal_labels.it_relevant"] = f"eq.{str(query['it_relevant']).lower()}"

    if query.get("topic"):
        topic = query["topic"].lower()
        params["proposal_labels.it_topics"] = f"cs.{{{topic}}}"

    if is_id_lookup:
        params["id"] = f"eq.{int(q)}"
    elif q:
        # PostgREST `or` syntax is comma-separated, so we sanitize a few characters that would
        # otherwise break the expression. This is not about SQL injection (PostgREST parses
        # the expression), but about keeping a valid filter string.
        safe = q.replace(",", " ").replace("(", " ").replace(")", " ").strip()
        like = f"ilike.*{safe}*"
        # Keep search on the base `proposals` table columns. (PostgREST `or=(...)` is reliable
        # here; mixing embedded-table columns inside `or` can be inconsistent depending on
        # API/view setup.)
        clauses: List[str] = [f"titel.{like}", f"nummer.{like}", f"resume.{like}"]
        params["or"] = f"({','.join(clauses)})"

    return _request("GET", "proposals", params=params) or []


def fetch_proposal_by_id(proposal_id: int) -> Optional[Dict[str, Any]]:
    params = {
        "select": "*,proposal_labels(*)",
        "id": f"eq.{proposal_id}",
        "limit": 1,
    }
    data = _request("GET", "proposals", params=params) or []
    return data[0] if data else None


def fetch_proposals_page(
    *,
    select: str,
    limit: int,
    offset: int,
    order: str = "id.asc",
    filters: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """
    Lightweight paging helper for internal maintenance tasks (e.g. backfills).
    """
    params: Dict[str, Any] = {
        "select": select,
        "limit": limit,
        "offset": offset,
        "order": order,
    }
    if filters:
        params.update(filters)
    return _request("GET", "proposals", params=params) or []


def get_last_watermark() -> Optional[str]:
    params = {
        "select": "last_watermark_after",
        "order": "last_watermark_after.desc",
        "limit": 1,
    }
    data = _request("GET", "ingestion_runs", params=params) or []
    if not data:
        return None
    return data[0].get("last_watermark_after")


def insert_ingestion_run(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Prefer": "return=representation"}
    data = _request("POST", "ingestion_runs", json=payload, headers=headers) or []
    if not data:
        raise Exception("Failed to create ingestion run")
    return data[0]


def update_ingestion_run(run_id: str, payload: Dict[str, Any]) -> None:
    params = {"id": f"eq.{run_id}"}
    _request("PATCH", "ingestion_runs", params=params, json=payload)


def upsert_proposal(payload: Dict[str, Any]) -> None:
    headers = {"Prefer": "resolution=merge-duplicates"}
    params = {"on_conflict": "id"}
    _request("POST", "proposals", params=params, json=payload, headers=headers)


def update_proposal(proposal_id: int, payload: Dict[str, Any]) -> None:
    params = {"id": f"eq.{proposal_id}"}
    _request("PATCH", "proposals", params=params, json=payload)


def upsert_proposal_label(payload: Dict[str, Any]) -> Dict[str, Any]:
    headers = {"Prefer": "resolution=merge-duplicates,return=representation"}
    params = {"on_conflict": "proposal_id"}
    data = _request("POST", "proposal_labels", params=params, json=payload, headers=headers) or []
    return data[0] if data else payload
