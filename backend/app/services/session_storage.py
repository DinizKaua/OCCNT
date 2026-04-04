from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import tempfile
from typing import Any, Dict, Iterator

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AppSession, DatasetImport, ForecastRun, generate_id, utcnow
from .forecast.csv_loader import detect_csv_metadata, detect_period_bounds, detect_source_frequency, preview_dataframe


def ensure_session(db: Session, session_id: str | None) -> tuple[AppSession, bool]:
    session_record = None
    if session_id:
        session_record = db.get(AppSession, session_id)

    if session_record is None:
        session_record = AppSession(id=generate_id())
        db.add(session_record)
        db.commit()
        db.refresh(session_record)
        return session_record, True

    session_record.updated_at = utcnow()
    db.add(session_record)
    db.commit()
    db.refresh(session_record)
    return session_record, session_record.id != session_id


def touch_session_disease(db: Session, session_record: AppSession, disease_slug: str) -> None:
    session_record.last_disease_slug = disease_slug
    session_record.updated_at = utcnow()
    db.add(session_record)
    db.commit()


def list_session_datasets(db: Session, session_id: str, disease_slug: str | None = None) -> list[dict]:
    statement = select(DatasetImport).where(DatasetImport.session_id == session_id)
    if disease_slug:
        statement = statement.where(DatasetImport.disease_slug == disease_slug)

    records = db.scalars(statement.order_by(DatasetImport.created_at.desc())).all()
    return [_dataset_to_dict(record) for record in records]


def list_session_exports(db: Session, session_id: str, disease_slug: str | None = None) -> list[dict]:
    statement = select(DatasetImport).where(
        DatasetImport.session_id == session_id,
        DatasetImport.source_group == "datasus",
    )
    if disease_slug:
        statement = statement.where(DatasetImport.disease_slug == disease_slug)

    records = db.scalars(statement.order_by(DatasetImport.created_at.desc())).all()
    return [
        {
            "dataset_id": record.id,
            "dataset_name": record.dataset_name,
            "created_at": record.created_at.isoformat(),
            "system": record.system,
            "uf": record.uf,
            "granularity": record.granularity,
            "year_start": record.year_start,
            "year_end": record.year_end,
            "icd_prefix": record.icd_prefix,
            "preferred_dataset_id": record.id,
            "preferred_file_name": record.preferred_file_name,
            "disease_slug": record.disease_slug,
        }
        for record in records
    ]


def save_datasus_import(
    db: Session,
    session_record: AppSession,
    disease_slug: str,
    disease_title: str,
    request_payload: Dict[str, Any],
    export_payload: Dict[str, Any],
) -> dict:
    tabnet_path = Path(export_payload["tabnet_path"])
    tidy_path = Path(export_payload["tidy_path"])

    tabnet_content = tabnet_path.read_bytes() if tabnet_path.exists() else b""
    tidy_content = tidy_path.read_bytes() if tidy_path.exists() else tabnet_content
    preferred_kind = "tidy" if tidy_content else "tabnet"
    preferred_content = tidy_content if preferred_kind == "tidy" else tabnet_content
    preferred_name = tidy_path.name if preferred_kind == "tidy" else tabnet_path.name

    with temporary_csv_file(preferred_content, preferred_name) as csv_path:
        metadata = detect_csv_metadata(csv_path)
        frequency = detect_source_frequency(csv_path)
        period_bounds = detect_period_bounds(csv_path)

    record = DatasetImport(
        session_id=session_record.id,
        disease_slug=disease_slug,
        disease_title=disease_title,
        source_group="datasus",
        dataset_name=export_payload["dataset_name"],
        display_name=_build_dataset_display_name(
            uf=str(request_payload.get("uf", "")),
            year_start=int(period_bounds["year_start"]),
            year_end=int(period_bounds["year_end"]),
            granularity=str(request_payload.get("granularity", "")),
            month_start=int(period_bounds["month_start"]),
            month_end=int(period_bounds["month_end"]),
        ),
        system=str(request_payload.get("system", "")),
        uf=str(request_payload.get("uf", "")),
        year_start=int(period_bounds["year_start"]),
        year_end=int(period_bounds["year_end"]),
        month_start=int(period_bounds["month_start"]),
        month_end=int(period_bounds["month_end"]),
        granularity=str(request_payload.get("granularity", "")),
        icd_prefix=str(request_payload.get("icd_prefix", "")),
        preferred_kind=preferred_kind,
        tabnet_file_name=tabnet_path.name,
        tidy_file_name=tidy_path.name,
        preferred_file_name=preferred_name,
        tabnet_content=tabnet_content,
        tidy_content=tidy_content,
        layout=metadata.layout,
        frequency=frequency,
        size_kb=round(len(preferred_content) / 1024, 2),
        command_payload=export_payload.get("command"),
        resolved_rscript=export_payload.get("resolved_rscript"),
        stdout_text=export_payload.get("stdout", ""),
        stderr_text=export_payload.get("stderr", ""),
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return _dataset_to_dict(record)


def get_dataset_record(db: Session, session_id: str, dataset_id: str) -> DatasetImport:
    record = db.get(DatasetImport, dataset_id)
    if record is None or record.session_id != session_id:
        raise FileNotFoundError(f"Dataset not found: {dataset_id}")
    return record


def preview_dataset_record(record: DatasetImport, limit: int = 20) -> dict:
    content = _preferred_content(record)
    with temporary_csv_file(content, record.preferred_file_name) as csv_path:
        preview_df = preview_dataframe(csv_path, limit=limit).fillna("")

    return {
        "dataset_id": record.id,
        "columns": [str(column) for column in preview_df.columns.tolist()],
        "rows": preview_df.astype(str).values.tolist(),
    }


def save_forecast_record(
    db: Session,
    session_record: AppSession,
    dataset_record: DatasetImport,
    disease_slug: str,
    request_payload: Dict[str, Any],
    prediction_payload: Dict[str, Any],
) -> dict:
    record = ForecastRun(
        session_id=session_record.id,
        dataset_id=dataset_record.id,
        disease_slug=disease_slug,
        request_payload=request_payload,
        result_payload=prediction_payload,
        model_label=str(prediction_payload.get("model", request_payload.get("model", ""))),
        output_frequency=str(prediction_payload.get("output_frequency", request_payload.get("mode", ""))),
        state_label=str(prediction_payload.get("state_label", "")),
        historical_count=len(prediction_payload.get("historical_data", [])),
        forecast_count=len(prediction_payload.get("forecast", [])),
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return forecast_to_detail(record)


def list_session_forecasts(db: Session, session_id: str, disease_slug: str | None = None) -> list[dict]:
    statement = select(ForecastRun).where(ForecastRun.session_id == session_id)
    if disease_slug:
        statement = statement.where(ForecastRun.disease_slug == disease_slug)

    records = db.scalars(statement.order_by(ForecastRun.created_at.desc())).all()
    return [
        {
            "forecast_id": record.id,
            "saved_at": record.created_at.isoformat(),
            "dataset_id": record.dataset_id,
            "model": record.model_label,
            "output_frequency": record.output_frequency,
            "state_label": record.state_label,
            "historical_count": record.historical_count,
            "forecast_count": record.forecast_count,
            "disease_slug": record.disease_slug,
        }
        for record in records
        if _forecast_payload_is_valid(record.result_payload)
    ]


def get_forecast_record(db: Session, session_id: str, forecast_id: str) -> ForecastRun:
    record = db.get(ForecastRun, forecast_id)
    if record is None or record.session_id != session_id:
        raise FileNotFoundError(f"Resultado nao encontrado: {forecast_id}")
    return record


def forecast_to_detail(record: ForecastRun) -> dict:
    return {
        "forecast_id": record.id,
        "saved_at": record.created_at.isoformat(),
        "dataset_id": record.dataset_id,
        "request": record.request_payload,
        "result": record.result_payload,
    }


def session_counts(db: Session, session_id: str) -> dict:
    datasets = list_session_datasets(db, session_id)
    exports = list_session_exports(db, session_id)
    forecasts = list_session_forecasts(db, session_id)
    return {
        "datasets_count": len(datasets),
        "exports_count": len(exports),
        "processed_count": len(forecasts),
    }


def resolve_dataset_state_query(record: DatasetImport, fallback: str | None = None) -> str:
    candidate = (record.uf or "").strip()
    if candidate and candidate != "--":
        return candidate
    return (fallback or "").strip() or "21"


@contextmanager
def temporary_dataset_path(record: DatasetImport) -> Iterator[Path]:
    content = _preferred_content(record)
    with temporary_csv_file(content, record.preferred_file_name) as csv_path:
        yield csv_path


@contextmanager
def temporary_csv_file(content: bytes, file_name: str) -> Iterator[Path]:
    suffix = Path(file_name).suffix or ".csv"
    handle = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    try:
        handle.write(content)
        handle.flush()
        handle.close()
        yield Path(handle.name)
    finally:
        try:
            Path(handle.name).unlink(missing_ok=True)
        except FileNotFoundError:
            pass


def _preferred_content(record: DatasetImport) -> bytes:
    if record.preferred_kind == "tidy" and record.tidy_content:
        return record.tidy_content
    if record.tabnet_content:
        return record.tabnet_content
    if record.tidy_content:
        return record.tidy_content
    raise FileNotFoundError("Dataset nao possui conteudo CSV disponivel.")


def _dataset_to_dict(record: DatasetImport) -> dict:
    return {
        "dataset_id": record.id,
        "file_name": record.preferred_file_name,
        "display_name": record.display_name,
        "source_group": record.source_group,
        "system": record.system,
        "uf": record.uf,
        "year_start": record.year_start,
        "year_end": record.year_end,
        "month_start": record.month_start,
        "month_end": record.month_end,
        "granularity": record.granularity,
        "layout": record.layout,
        "frequency": record.frequency,
        "size_kb": record.size_kb,
        "updated_at": record.updated_at.isoformat(),
        "disease_slug": record.disease_slug,
    }


def _forecast_payload_is_valid(payload: Dict[str, Any] | None) -> bool:
    if not payload:
        return False

    historical = payload.get("historical_data", [])
    forecast = payload.get("forecast", [])
    if not historical or not forecast:
        return False

    historical_values = [float(item.get("value", 0.0)) for item in historical if item.get("value") is not None]
    forecast_values = [float(item.get("value", 0.0)) for item in forecast if item.get("value") is not None]
    if not historical_values or not forecast_values:
        return False

    reference = max(historical_values[-1], max(historical_values), 1.0)
    peak_forecast = max(forecast_values)
    spread_forecast = peak_forecast - min(forecast_values)
    recent_history = historical_values[-5:]
    recent_range = max(recent_history) - min(recent_history) if recent_history else 0.0

    if peak_forecast <= 0.0 or peak_forecast > reference * 25:
        return False
    if spread_forecast <= max(reference * 0.005, 1.0) and recent_range >= max(reference * 0.03, 15.0):
        return False
    return True


def _build_dataset_display_name(
    uf: str,
    year_start: int,
    year_end: int,
    granularity: str,
    month_start: int,
    month_end: int,
) -> str:
    uf_label = (uf or "--").strip().upper()
    if granularity == "month":
        return f"{uf_label} {year_start}/{month_start:02d}-{year_end}/{month_end:02d}"
    return f"{uf_label} {year_start}-{year_end}"
