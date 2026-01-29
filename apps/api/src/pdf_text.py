from __future__ import annotations

import io
import os
from typing import Optional

import httpx


def _normalize_text(text: str) -> str:
    # Keep it readable for LLM context.
    text = text.replace("\x00", "")
    lines = [line.strip() for line in text.splitlines()]
    lines = [line for line in lines if line]
    return "\n".join(lines)


def _default_user_agent() -> str:
    # A boring, modern browser UA tends to avoid basic WAF blocks.
    return (
        os.getenv("PDF_FETCH_USER_AGENT")
        or "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )


def _default_referer() -> str:
    return os.getenv("PDF_FETCH_REFERER") or "https://www.ft.dk/"


def _download_pdf(url: str, *, timeout_seconds: float) -> bytes:
    # Try a couple of header profiles to get past simple Cloudflare/WAF blocking.
    header_profiles = [
        {
            "User-Agent": _default_user_agent(),
            "Accept": "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
            "Accept-Language": "da,en-US;q=0.8,en;q=0.7",
            "Referer": _default_referer(),
        },
        {
            "User-Agent": _default_user_agent(),
            "Accept": "*/*",
            "Accept-Language": "da,en-US;q=0.8,en;q=0.7",
        },
    ]

    last_exc: Optional[Exception] = None
    for headers in header_profiles:
        try:
            with httpx.Client(
                timeout=timeout_seconds,
                follow_redirects=True,
                headers=headers,
            ) as client:
                resp = client.get(url)
                if resp.status_code == 403:
                    raise httpx.HTTPStatusError("403 Forbidden", request=resp.request, response=resp)
                resp.raise_for_status()
                content_type = (resp.headers.get("content-type") or "").lower()
                if "text/html" in content_type:
                    # Often a WAF/Cloudflare block page. Treat as failure so we can retry.
                    raise ValueError(f"Expected PDF bytes, got content-type={content_type}")
                return resp.content
        except Exception as e:
            last_exc = e
            continue

    if last_exc:
        raise last_exc
    raise RuntimeError("Failed to download PDF")


def extract_text_from_pdf_bytes(pdf_bytes: bytes, *, max_pages: Optional[int] = None) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(pdf_bytes))
    pages = reader.pages
    if max_pages is not None:
        pages = pages[: max_pages]

    chunks: list[str] = []
    for page in pages:
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        if t:
            chunks.append(t)
    return _normalize_text("\n\n".join(chunks))


def extract_text_from_pdf_url(
    url: str,
    *,
    max_pages: Optional[int] = None,
    timeout_seconds: float = 30.0,
) -> str:
    pdf_bytes = _download_pdf(url, timeout_seconds=timeout_seconds)
    return extract_text_from_pdf_bytes(pdf_bytes, max_pages=max_pages)
