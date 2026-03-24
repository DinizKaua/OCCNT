from __future__ import annotations

from datetime import datetime
from pathlib import Path
import shutil
from typing import Any, Dict, List

from fastapi import UploadFile

from ..config import DATA_DIR, EXPORTS_DIR, SAMPLES_DIR
from .forecast.csv_loader import detect_csv_metadata, detect_source_frequency, preview_dataframe
from .storage_names import build_manual_upload_name


def list_dataset_files() -> List[Dict[str, Any]]:
    entries: List[Dict[str, Any]] = []
    for root in (EXPORTS_DIR, SAMPLES_DIR):
        if not root.exists():
            continue
        for csv_file in root.rglob("*.csv"):
            if not csv_file.is_file():
                continue
            entries.append(_build_dataset_entry(csv_file, root.name))
    entries.sort(key=lambda item: item["updated_at"], reverse=True)
    return entries


def get_dataset_info(file_id: str) -> Dict[str, Any]:
    dataset_path = resolve_dataset_path(file_id)
    relative_parts = dataset_path.resolve().relative_to(DATA_DIR.resolve()).parts
    source_group = relative_parts[0] if relative_parts else "data"
    return _build_dataset_entry(dataset_path, source_group)


def resolve_dataset_path(file_id: str) -> Path:
    clean_file_id = (file_id or "").replace("\\", "/").lstrip("/")
    if not clean_file_id:
        raise FileNotFoundError("Dataset file was not provided.")
    if ".." in clean_file_id:
        raise FileNotFoundError("Invalid dataset path.")

    absolute_path = (DATA_DIR / clean_file_id).resolve()
    data_dir_resolved = DATA_DIR.resolve()
    if data_dir_resolved not in absolute_path.parents and absolute_path != data_dir_resolved:
        raise FileNotFoundError("Dataset path is outside backend/data.")
    if not absolute_path.exists() or not absolute_path.is_file():
        raise FileNotFoundError(f"Dataset not found: {clean_file_id}")
    if absolute_path.suffix.lower() != ".csv":
        raise FileNotFoundError("Dataset must be a CSV file.")
    return absolute_path


def preview_dataset(file_id: str, limit: int = 20) -> Dict[str, Any]:
    dataset_path = resolve_dataset_path(file_id)
    preview_df = preview_dataframe(dataset_path, limit=limit)
    preview_df = preview_df.fillna("")
    return {
        "file_id": file_id,
        "columns": [str(column) for column in preview_df.columns.tolist()],
        "rows": preview_df.astype(str).values.tolist(),
    }


def save_uploaded_dataset(upload: UploadFile) -> str:
    original_name = upload.filename or "dataset.csv"
    upload_folder = EXPORTS_DIR / "uploads"
    upload_folder.mkdir(parents=True, exist_ok=True)
    destination = _unique_file_path(upload_folder / build_manual_upload_name(original_name))

    try:
        with destination.open("wb") as handle:
            shutil.copyfileobj(upload.file, handle)
    finally:
        upload.file.close()

    return dataset_id_from_path(destination)


def dataset_id_from_path(path: Path) -> str:
    return path.resolve().relative_to(DATA_DIR.resolve()).as_posix()

def _build_dataset_entry(csv_file: Path, source_group: str) -> Dict[str, Any]:
    layout = "unknown"
    frequency = "unknown"
    try:
        metadata = detect_csv_metadata(csv_file)
        layout = metadata.layout
        frequency = detect_source_frequency(csv_file)
    except Exception:
        pass

    stat_info = csv_file.stat()
    display_name = _display_dataset_name(csv_file)
    return {
        "file_id": dataset_id_from_path(csv_file),
        "file_name": csv_file.name,
        "display_name": display_name,
        "source_group": source_group,
        "layout": layout,
        "frequency": frequency,
        "size_kb": round(stat_info.st_size / 1024, 2),
        "updated_at": datetime.fromtimestamp(stat_info.st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
    }


def _unique_file_path(base_path: Path) -> Path:
    if not base_path.exists():
        return base_path
    stem = base_path.stem
    suffix = base_path.suffix
    for number in range(2, 1000):
        candidate = base_path.with_name(f"{stem}_{number}{suffix}")
        if not candidate.exists():
            return candidate
    raise RuntimeError("Unable to allocate destination file for uploaded dataset.")


def _display_dataset_name(csv_file: Path) -> str:
    generic_parents = {"exports", "samples", "uploads", ""}
    parent_name = csv_file.parent.name.strip()
    if parent_name.lower() in generic_parents:
        return csv_file.name
    return f"{parent_name} | {csv_file.name}"
