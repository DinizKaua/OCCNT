from __future__ import annotations

from datetime import datetime
from pathlib import Path
import re


def build_timestamp_tag() -> str:
    return datetime.utcnow().strftime("%y%m%d%H%M%S")


def slugify_identifier(value: str, default: str = "item") -> str:
    normalized = (value or "").strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    normalized = normalized.strip("_")
    return normalized or default


def build_export_batch_name(
    system: str,
    uf: str,
    granularity: str,
    year_start: int,
    year_end: int,
    month_start: int,
    month_end: int,
    icd_prefix: str,
) -> str:
    if granularity == "month":
        period_tag = f"{year_start}{month_start:02d}_{year_end}{month_end:02d}"
    else:
        period_tag = f"{year_start}_{year_end}"
    timestamp_tag = build_timestamp_tag()
    return slugify_identifier(f"{system}_{uf}_{period_tag}_{timestamp_tag}", default="lote")


def build_export_dataset_file_name(batch_name: str, dataset_kind: str) -> str:
    normalized_kind = slugify_identifier(dataset_kind, default="dados")
    suffix = "raw" if "brut" in normalized_kind else "base"
    return f"{slugify_identifier(batch_name, 'lote')}_{suffix}.csv"


def build_export_manifest_name(batch_name: str) -> str:
    return f"{slugify_identifier(batch_name, 'lote')}.json"


def build_manual_upload_name(original_name: str) -> str:
    original_path = Path(original_name or "dataset.csv")
    stem = slugify_identifier(original_path.stem, default="dataset")
    timestamp_tag = build_timestamp_tag()
    return f"up_{stem}_{timestamp_tag}.csv"


def build_processed_result_name(
    model: str,
    frequency: str,
    state: str,
    dataset_file: str,
) -> str:
    dataset_path = Path(dataset_file)
    generic_parents = {"exports", "samples", "processed", "uploads", ""}
    parent_name = dataset_path.parent.name.strip().lower()
    if parent_name and parent_name not in generic_parents:
        dataset_tag = slugify_identifier(parent_name, default="dataset")
    else:
        dataset_tag = slugify_identifier(dataset_path.stem, default="dataset")

    timestamp_tag = build_timestamp_tag()
    frequency_label = _frequency_label(frequency)
    return (
        f"pred_{slugify_identifier(model, 'modelo')}_"
        f"{frequency_label}_"
        f"{slugify_identifier(state, 'estado')}_"
        f"{dataset_tag}_{timestamp_tag}.json"
    )


def _frequency_label(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized == "annual":
        return "anual"
    if normalized == "monthly":
        return "mensal"
    return slugify_identifier(normalized, "saida")
