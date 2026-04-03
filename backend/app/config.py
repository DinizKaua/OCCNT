from __future__ import annotations

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
EXPORTS_DIR = DATA_DIR / "exports"
SAMPLES_DIR = DATA_DIR / "samples"
PROCESSED_DIR = DATA_DIR / "processed"
SCRIPTS_DIR = BASE_DIR / "scripts"
R_EXPORT_SCRIPT = SCRIPTS_DIR / "export_datasus_database.R"


def ensure_runtime_directories() -> None:
    for path in (
        DATA_DIR,
        EXPORTS_DIR,
        SAMPLES_DIR,
        PROCESSED_DIR,
        SCRIPTS_DIR,
    ):
        path.mkdir(parents=True, exist_ok=True)
