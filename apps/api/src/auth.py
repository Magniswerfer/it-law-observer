from __future__ import annotations

import os
from typing import Any, Dict, Optional, Set

import httpx
from fastapi import Depends, HTTPException, Request

from .config import load_env

load_env()


def _parse_admin_emails() -> Optional[Set[str]]:
    raw = (os.getenv("ADMIN_EMAILS") or "").strip()
    if not raw:
        return None
    emails = {e.strip().lower() for e in raw.split(",") if e.strip()}
    return emails or None


def _supabase_url() -> str:
    url = (os.getenv("SUPABASE_URL") or "").strip()
    if not url:
        raise ValueError("SUPABASE_URL is required")
    return url.rstrip("/")


def _supabase_auth_key() -> str:
    """
    Key used to call Supabase Auth endpoints.

    Service Role key is preferred for backend calls, but anon also works for /auth/v1/user.
    """
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SECRET_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()
    if not key:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY/SUPABASE_ANON_KEY) is required")
    return key


async def _fetch_user(access_token: str) -> Dict[str, Any]:
    url = f"{_supabase_url()}/auth/v1/user"
    headers = {
        "apikey": _supabase_auth_key(),
        "Authorization": f"Bearer {access_token}",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=headers)
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    data = resp.json()
    if not isinstance(data, dict):
        raise HTTPException(status_code=401, detail="Invalid session payload")
    return data


async def require_admin(request: Request) -> Dict[str, Any]:
    """
    Validates Supabase access token and (optionally) enforces ADMIN_EMAILS allowlist.
    """
    auth = request.headers.get("authorization") or ""
    if not auth.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    user = await _fetch_user(token)
    allow = _parse_admin_emails()
    if allow is None:
        return user

    email = (user.get("email") or "").strip().lower()
    if not email or email not in allow:
        raise HTTPException(status_code=403, detail="Not authorized")
    return user


AdminUser = Dict[str, Any]
RequireAdmin = Depends(require_admin)

