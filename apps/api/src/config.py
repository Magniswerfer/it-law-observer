from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv


def load_env() -> None:
    """
    Load `apps/api/.env` regardless of current working directory.

    Note: Uvicorn is often started from the repo root, so relying on `load_dotenv()`
    without an explicit path can silently miss the intended env file.
    """
    api_dir = Path(__file__).resolve().parents[1]
    load_dotenv(dotenv_path=api_dir / ".env", override=False)

