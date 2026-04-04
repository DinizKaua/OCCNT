from __future__ import annotations

from typing import Any, Dict, Optional

from ..config import DATABASE_URL, DATA_DIR, R_EXPORT_SCRIPT, RUNTIME_DIR, SAMPLES_DIR, TEMP_EXPORTS_DIR
from ..database import check_database_connection
from .datasus_export import resolve_rscript_command


def get_runtime_status(counts: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    counts = counts or {}

    rscript_path = ""
    rscript_ready = False
    rscript_message = ""
    try:
        rscript_path = resolve_rscript_command("Rscript")
        rscript_ready = True
    except Exception as exc:  # noqa: BLE001
        rscript_message = str(exc)

    database_ready, database_message = check_database_connection()
    return {
        "data_dir": str(DATA_DIR),
        "samples_dir": str(SAMPLES_DIR),
        "runtime_dir": str(RUNTIME_DIR),
        "temp_exports_dir": str(TEMP_EXPORTS_DIR),
        "r_export_script_exists": R_EXPORT_SCRIPT.exists(),
        "r_export_script": str(R_EXPORT_SCRIPT),
        "rscript_ready": rscript_ready,
        "rscript_path": rscript_path,
        "rscript_message": rscript_message,
        "database_ready": database_ready,
        "database_message": database_message,
        "database_url": DATABASE_URL,
        "datasets_count": int(counts.get("datasets_count", 0)),
        "exports_count": int(counts.get("exports_count", 0)),
        "processed_count": int(counts.get("processed_count", 0)),
        "pipeline_ready": bool(rscript_ready and R_EXPORT_SCRIPT.exists() and database_ready),
    }
