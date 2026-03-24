from __future__ import annotations

from datetime import datetime
import json
from pathlib import Path
from typing import Any, Dict, List

from ..config import PROCESSED_DIR
from .storage_names import build_processed_result_name


def save_processed_result(
    prediction_payload: Dict[str, Any],
    dataset_file: str,
    request_params: Dict[str, Any],
) -> Dict[str, Any]:
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    file_name = build_processed_result_name(
        model=str(request_params.get("model", "model")),
        frequency=str(prediction_payload.get("output_frequency", "output")),
        state=str(request_params.get("state", "estado")),
        dataset_file=dataset_file,
    )
    file_path = _unique_file(PROCESSED_DIR / file_name)

    payload = {
        "saved_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "dataset_file": dataset_file,
        "request": request_params,
        "result": prediction_payload,
    }
    with file_path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    return _build_result_entry(file_path, payload)


def list_processed_results(limit: int = 300) -> List[Dict[str, Any]]:
    if not PROCESSED_DIR.exists():
        return []

    entries: List[Dict[str, Any]] = []
    for json_file in PROCESSED_DIR.glob("*.json"):
        if not json_file.is_file():
            continue
        try:
            with json_file.open("r", encoding="utf-8") as handle:
                payload = json.load(handle)
            entries.append(_build_result_entry(json_file, payload))
        except Exception:
            continue
    entries.sort(key=lambda item: item.get("saved_at", ""), reverse=True)
    return entries[:limit]


def load_processed_result(result_file: str) -> Dict[str, Any]:
    target_path = _resolve_result_file(result_file)
    with target_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return {
        "result_file": target_path.name,
        "saved_at": payload.get("saved_at", ""),
        "dataset_file": payload.get("dataset_file", ""),
        "request": payload.get("request", {}),
        "result": payload.get("result", {}),
    }


def _resolve_result_file(result_file: str) -> Path:
    clean_name = Path(result_file).name
    if not clean_name.endswith(".json"):
        raise FileNotFoundError("Processed result must be a JSON file.")
    target = (PROCESSED_DIR / clean_name).resolve()
    if PROCESSED_DIR.resolve() not in target.parents:
        raise FileNotFoundError("Invalid result file path.")
    if not target.exists() or not target.is_file():
        raise FileNotFoundError(f"Processed result not found: {clean_name}")
    return target


def _build_result_entry(file_path: Path, payload: Dict[str, Any]) -> Dict[str, Any]:
    result = payload.get("result", {})
    request = payload.get("request", {})
    historical_count = len(result.get("historical_data", []))
    forecast_count = len(result.get("forecast", []))
    return {
        "result_file": file_path.name,
        "saved_at": payload.get("saved_at", ""),
        "dataset_file": payload.get("dataset_file", ""),
        "model": str(result.get("model", request.get("model", ""))),
        "output_frequency": str(result.get("output_frequency", request.get("mode", ""))),
        "state_label": str(result.get("state_label", "")),
        "historical_count": historical_count,
        "forecast_count": forecast_count,
    }
def _unique_file(base_file: Path) -> Path:
    if not base_file.exists():
        return base_file
    stem = base_file.stem
    suffix = base_file.suffix
    for number in range(2, 1000):
        candidate = base_file.with_name(f"{stem}_{number}{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError("Unable to create unique filename for processed result.")
