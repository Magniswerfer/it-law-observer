"""
Helpers for working with Folketingets ODA API beyond the main /Sag feed.

In particular, this module follows the Sag → SagDokument → Dokument → Fil chain
to find direct file URLs (e.g. PDFs) for a given case (Sag).

Note: querying /Fil?$filter=dokumentid eq ... does not work reliably, so we always
resolve files via /Dokument?$expand=Fil.
"""

from __future__ import annotations

import random
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

ODA_BASE_URL = "https://oda.ft.dk/api"

MAIN_DOKUMENT_TYPE_ID = 21
MAIN_DOKUMENT_KATEGORI_ID = 31
PAGE_SIZE = 100

def _is_pdf_format(value: Optional[str]) -> bool:
    if not value:
        return False
    return value.strip().upper() == "PDF"

def _coerce_int(value: Any) -> Optional[int]:
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        raw = value.strip()
        if raw.isdigit():
            try:
                return int(raw)
            except Exception:
                return None
    return None


def _is_main_bill_dokument(dokument: Dict[str, Any]) -> bool:
    # Heuristic: the primary law-text document is typically identified by
    # Dokument.typeid == 21 and/or Dokument.kategoriid == 31.
    # This is more robust than title matching across varying wording.
    typeid = _coerce_int(dokument.get("typeid")) or dokument.get("typeid")
    kategoriid = _coerce_int(dokument.get("kategoriid")) or dokument.get("kategoriid")
    return typeid == MAIN_DOKUMENT_TYPE_ID or kategoriid == MAIN_DOKUMENT_KATEGORI_ID


def _extract_file_url(file_obj: Dict[str, Any]) -> Optional[str]:
    """
    ODA's file URL field name can differ depending on endpoint/schema shape.
    Prefer common candidates, then fall back to any '*url*' string field.
    """
    for key in ("url", "filurl", "downloadurl", "link"):
        value = file_obj.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    for key, value in file_obj.items():
        if "url" in str(key).lower() and isinstance(value, str) and value.strip():
            return value.strip()

    return None


def _get_json_with_retry(
    client: httpx.Client,
    url: str,
    params: Dict[str, Any],
    *,
    max_retries: int = 2,
) -> Dict[str, Any]:
    """
    Basic retry logic for transient ODA errors (timeouts, 5xx, 429).
    We keep this conservative to avoid hammering the API.
    """
    attempt = 0
    while True:
        try:
            resp = client.get(url, params=params)
            if resp.status_code in (429,) or 500 <= resp.status_code <= 599:
                raise httpx.HTTPStatusError(
                    f"Transient ODA status {resp.status_code}", request=resp.request, response=resp
                )
            resp.raise_for_status()
            data = resp.json()
            if isinstance(data, dict):
                return data
            return {"value": data}
        except (httpx.TimeoutException, httpx.TransportError, httpx.HTTPStatusError) as e:
            if attempt >= max_retries:
                raise e
            # Exponential backoff with jitter.
            sleep_s = (0.5 * (2**attempt)) + random.random() * 0.25
            time.sleep(sleep_s)
            attempt += 1


def _extract_pdf_urls_from_dokument(dokument: Dict[str, Any]) -> List[str]:
    """
    Extract PDF URLs from Dokument.Fil.

    We filter by Fil.format == "PDF" because ODA Fil rows can include other formats,
    and `filurl` is the concrete downloadable URL for the file.
    """
    # The expand is typically `Fil`, but be defensive in case of schema changes.
    files = dokument.get("Fil") or dokument.get("fil") or []
    if not isinstance(files, list):
        return []

    pdf_files = [f for f in files if isinstance(f, dict) and _is_pdf_format(f.get("format"))]
    if not pdf_files:
        return []

    # Prefer "P" (typically the primary variant) when present.
    primary = [f for f in pdf_files if str(f.get("variantkode") or "").upper() == "P"]
    chosen = primary or pdf_files

    urls: List[str] = []
    for file_obj in chosen:
        url = _extract_file_url(file_obj)
        if url:
            urls.append(url)

    # Deduplicate while preserving order.
    seen = set()
    unique: List[str] = []
    for url in urls:
        if url in seen:
            continue
        seen.add(url)
        unique.append(url)
    return unique


def fetch_sagdokument_rows_for_sag(
    client: httpx.Client,
    sag_id: int,
    *,
    max_retries: int = 2,
) -> List[Dict[str, Any]]:
    """
    Fetch SagDokument rows for a Sag.

    We keep this call small (no expands). The document metadata + files are resolved
    via /Dokument?$expand=Fil per dokumentid.
    """
    url = f"{ODA_BASE_URL}/SagDokument"
    # Paginate defensively: some Sager have many documents and ODA may return a default page size.
    params = {"$filter": f"sagid eq {sag_id}", "$format": "json", "$top": PAGE_SIZE}
    rows: List[Dict[str, Any]] = []
    skip = 0
    while True:
        params["$skip"] = skip
        payload = _get_json_with_retry(client, url, params, max_retries=max_retries)
        page = payload.get("value", []) or []
        if not isinstance(page, list) or not page:
            break
        rows.extend([r for r in page if isinstance(r, dict)])
        skip += PAGE_SIZE
    return rows


def fetch_dokument_with_fil(
    client: httpx.Client,
    dokument_id: int,
    *,
    max_retries: int = 2,
) -> Optional[Dict[str, Any]]:
    """
    Fetch a single Dokument (by id) expanded with Fil.

    Note: querying /Fil?$filter=dokumentid eq ... does not work reliably, so we always
    go through this endpoint.
    """
    url = f"{ODA_BASE_URL}/Dokument"
    params = {"$filter": f"id eq {dokument_id}", "$expand": "Fil", "$format": "json"}
    payload = _get_json_with_retry(client, url, params, max_retries=max_retries)
    value = payload.get("value", []) or []
    if not isinstance(value, list) or not value:
        return None
    doc = value[0]
    return doc if isinstance(doc, dict) else None


def fetch_fil_rows_for_dokument(
    client: httpx.Client,
    dokument_id: int,
    *,
    max_retries: int = 2,
) -> List[Dict[str, Any]]:
    """
    Fallback: fetch Fil rows directly for a Dokument.

    ODA's /Fil endpoint has historically been less reliable than using /Dokument?$expand=Fil,
    but this helps when the expand yields empty/missing Fil data.
    """
    url = f"{ODA_BASE_URL}/Fil"
    params = {"$filter": f"dokumentid eq {dokument_id}", "$format": "json", "$top": PAGE_SIZE}
    rows: List[Dict[str, Any]] = []
    skip = 0
    while True:
        params["$skip"] = skip
        payload = _get_json_with_retry(client, url, params, max_retries=max_retries)
        page = payload.get("value", []) or []
        if not isinstance(page, list) or not page:
            break
        rows.extend([r for r in page if isinstance(r, dict)])
        skip += PAGE_SIZE
    return rows


def fetch_pdf_urls_for_sag(
    client: httpx.Client,
    sag: Dict[str, Any],
    *,
    delay_ms: int = 0,
    max_retries: int = 2,
) -> Dict[str, Any]:
    """
    Fetch related documents for a Sag and extract relevant PDF URLs.

    Returns a small DTO so callers can either attach `pdfUrls` to the Sag object
    or persist it separately.
    """
    sag_id = sag.get("id")
    if not sag_id:
        return {"sagId": None, "mainPdfUrl": None, "pdfUrls": [], "documents": []}

    if delay_ms > 0:
        # Small delay to avoid hammering ODA when iterating many Sager.
        time.sleep(delay_ms / 1000.0)

    # New chain:
    #   Sag -> SagDokument (gives dokumentid) -> Dokument (+Fil) -> Fil.filurl
    # We identify the main law-text document by (Dokument.typeid == 21 OR Dokument.kategoriid == 31).
    sagdokument_rows = fetch_sagdokument_rows_for_sag(client, int(sag_id), max_retries=max_retries)

    documents_debug: List[Dict[str, Any]] = []
    best: Optional[Tuple[Tuple[int, str, int], Dict[str, Any], List[str]]] = None

    for idx, row in enumerate(sagdokument_rows):
        if not isinstance(row, dict):
            continue

        dokument_id = _coerce_int(row.get("dokumentid"))
        if dokument_id is None:
            continue

        dokument = fetch_dokument_with_fil(client, dokument_id, max_retries=max_retries)
        if not dokument:
            continue

        is_main_candidate = _is_main_bill_dokument(dokument)

        pdf_urls = _extract_pdf_urls_from_dokument(dokument)
        if not pdf_urls:
            # Expand can sometimes be empty; as a last resort, try /Fil directly.
            fil_rows = fetch_fil_rows_for_dokument(client, dokument_id, max_retries=max_retries)
            if fil_rows:
                dokument_with_fallback = dict(dokument)
                dokument_with_fallback["Fil"] = fil_rows
                pdf_urls = _extract_pdf_urls_from_dokument(dokument_with_fallback)

        # Keep lightweight debug info (useful when a known PDF exists but isn't discovered).
        documents_debug.append(
            {
                "dokumentId": dokument.get("id") or dokument_id,
                "typeid": dokument.get("typeid"),
                "kategoriid": dokument.get("kategoriid"),
                "titel": dokument.get("titel"),
                "sagDokumentFrigivelsesdato": row.get("frigivelsesdato"),
                "isMainCandidate": is_main_candidate,
                "pdfUrls": pdf_urls,
            }
        )

        if not is_main_candidate or not pdf_urls:
            continue

        frigivelsesdato = row.get("frigivelsesdato")
        frigivelsesdato_key = frigivelsesdato if isinstance(frigivelsesdato, str) else ""
        sort_key = (0 if frigivelsesdato_key else 1, frigivelsesdato_key, idx)

        if best is None or sort_key < best[0]:
            best = (sort_key, dokument, pdf_urls)

    main_pdf_url: Optional[str] = None
    urls: List[str] = []
    if best is not None:
        urls = best[2]
        main_pdf_url = urls[0] if urls else None
    else:
        # Fallback: if our "main document" heuristic fails, still return *some* PDFs.
        # This is preferable to returning nothing when a known PDF exists.
        for doc in documents_debug:
            pdfs = doc.get("pdfUrls") or []
            if isinstance(pdfs, list) and pdfs:
                urls = [u for u in pdfs if isinstance(u, str) and u.strip()]
                main_pdf_url = urls[0] if urls else None
                break

    return {"sagId": sag_id, "mainPdfUrl": main_pdf_url, "pdfUrls": urls, "documents": documents_debug}
