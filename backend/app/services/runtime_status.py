from __future__ import annotations

from typing import Any, Dict, List, Optional

from ..config import DATA_DIR, EXPORTS_DIR, PROCESSED_DIR, R_EXPORT_SCRIPT, SAMPLES_DIR
from .dataset_catalog import list_dataset_files
from .datasus_export import list_export_jobs, resolve_rscript_command
from .processed_results import list_processed_results


def get_runtime_status(
    datasets: Optional[List[Dict[str, Any]]] = None,
    exports: Optional[List[Dict[str, Any]]] = None,
    processed: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    datasets = datasets if datasets is not None else list_dataset_files()
    exports = exports if exports is not None else list_export_jobs()
    processed = processed if processed is not None else list_processed_results()

    rscript_path = ""
    rscript_ready = False
    rscript_message = ""
    try:
        rscript_path = resolve_rscript_command("Rscript")
        rscript_ready = True
    except Exception as exc:
        rscript_message = str(exc)

    return {
        "data_dir": str(DATA_DIR),
        "exports_dir": str(EXPORTS_DIR),
        "samples_dir": str(SAMPLES_DIR),
        "processed_dir": str(PROCESSED_DIR),
        "r_export_script_exists": R_EXPORT_SCRIPT.exists(),
        "r_export_script": str(R_EXPORT_SCRIPT),
        "rscript_ready": rscript_ready,
        "rscript_path": rscript_path,
        "rscript_message": rscript_message,
        "datasets_count": len(datasets),
        "exports_count": len(exports),
        "processed_count": len(processed),
        "sample_datasets_count": len([item for item in datasets if item.get("source_group") == "samples"]),
        "pipeline_ready": bool(rscript_ready and R_EXPORT_SCRIPT.exists()),
    }
