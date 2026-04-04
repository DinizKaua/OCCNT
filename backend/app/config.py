from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
SAMPLES_DIR = DATA_DIR / "samples"
SCRIPTS_DIR = BASE_DIR / "scripts"
RUNTIME_DIR = BASE_DIR / "runtime"
TEMP_EXPORTS_DIR = RUNTIME_DIR / "exports"
TEMP_FILES_DIR = RUNTIME_DIR / "temp"
R_EXPORT_SCRIPT = SCRIPTS_DIR / "export_datasus_database.R"
SESSION_COOKIE_NAME = "occnt_session_id"

POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "127.0.0.1")
POSTGRES_PORT = int(os.environ.get("POSTGRES_PORT", "5432"))
POSTGRES_DB = os.environ.get("POSTGRES_DB", "occnt")
POSTGRES_USER = os.environ.get("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "postgres")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    f"postgresql+psycopg://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}",
)


def ensure_runtime_directories() -> None:
    for path in (
        DATA_DIR,
        SAMPLES_DIR,
        SCRIPTS_DIR,
        RUNTIME_DIR,
        TEMP_EXPORTS_DIR,
        TEMP_FILES_DIR,
    ):
        path.mkdir(parents=True, exist_ok=True)
