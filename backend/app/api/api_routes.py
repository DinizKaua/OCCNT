from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_session
from ..models import AppSession
from ..schemas import (
    DatasetInfo,
    DatasusExportRequest,
    DatasusExportResponse,
    ForecastRequest,
    ForecastResponse,
    SessionInfo,
)
from ..services.datasus_export import cleanup_export_output, run_datasus_export
from ..services.datasus_availability import get_datasus_availability
from ..services.prediction_engine import generate_forecast, get_available_model_options
from ..services.runtime_status import get_runtime_status
from ..services.session_storage import (
    forecast_to_detail,
    get_dataset_record,
    get_forecast_record,
    list_session_datasets,
    list_session_exports,
    list_session_forecasts,
    preview_dataset_record,
    resolve_dataset_state_query,
    save_datasus_import,
    save_forecast_record,
    session_counts,
    temporary_dataset_path,
    touch_session_disease,
)
from ..ui_options import (
    CID_PROFILE_OPTIONS,
    CONFIDENCE_OPTIONS,
    FORECAST_PERIOD_OPTIONS,
    FORECAST_YEAR_OPTIONS,
    GRANULARITY_OPTIONS,
    MODE_OPTIONS,
    SEASONAL_OPTIONS,
    SYSTEM_OPTIONS,
    UF_OPTIONS,
    month_options,
    year_options,
)

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@router.get("/session", response_model=SessionInfo)
def current_session(session_record: AppSession = Depends(get_current_session)) -> SessionInfo:
    return SessionInfo(
        session_id=session_record.id,
        created_at=session_record.created_at.isoformat(),
        updated_at=session_record.updated_at.isoformat(),
        last_disease_slug=session_record.last_disease_slug,
    )


@router.get("/runtime")
def runtime_status(
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> dict:
    return get_runtime_status(counts=session_counts(db, session_record.id))


@router.get("/ui/options")
def get_ui_options() -> dict:
    fallback_years = year_options(start=2008)
    availability = None
    try:
        availability = get_datasus_availability(system="SIM-DO", uf="MA", granularity="year")
        years = availability["year_options"]
        default_end_year = years[-1]
    except Exception:
        years = fallback_years
        current_year = datetime.utcnow().year
        default_end_year = years[-2] if len(years) > 1 and years[-1] >= current_year else years[-1]
    default_start_year = max(years[0], default_end_year - 6)

    return {
        "system_options": SYSTEM_OPTIONS,
        "uf_options": UF_OPTIONS,
        "state_options": [{"value": item["code"], "label": f'{item["code"]} {item["name"]}'} for item in UF_OPTIONS],
        "granularity_options": GRANULARITY_OPTIONS,
        "cid_profile_options": CID_PROFILE_OPTIONS,
        "mode_options": MODE_OPTIONS,
        "model_options": get_available_model_options(),
        "confidence_options": CONFIDENCE_OPTIONS,
        "forecast_year_options": FORECAST_YEAR_OPTIONS,
        "forecast_period_options": FORECAST_PERIOD_OPTIONS,
        "seasonal_options": SEASONAL_OPTIONS,
        "year_options": years,
        "month_options": month_options(),
        "initial_availability": availability,
        "defaults": {
            "export": {
                "system": "SIM-DO",
                "uf": "MA",
                "year_start": default_start_year,
                "year_end": default_end_year,
                "granularity": "year",
                "month_start": 1,
                "month_end": 12,
                "icd_prefix": "",
            },
            "predict": {
                "state": "21",
                "mode": "auto",
                "model": "arima",
                "forecast_years": 4,
                "forecast_periods": 48,
                "confidence": 0.95,
                "seasonal": None,
            },
        },
    }


@router.get("/ui/availability")
def get_ui_availability(
    system: str = Query(default="SIM-DO"),
    uf: str = Query(default="MA"),
    granularity: str = Query(default="year"),
) -> dict:
    try:
        return get_datasus_availability(system=system, uf=uf, granularity=granularity)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/datasets", response_model=list[DatasetInfo])
def get_datasets(
    disease_slug: str | None = Query(default=None),
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> list[DatasetInfo]:
    return [DatasetInfo(**entry) for entry in list_session_datasets(db, session_record.id, disease_slug=disease_slug)]


@router.get("/datasets/preview")
def get_dataset_preview(
    dataset_id: str = Query(..., description="Dataset UUID stored in PostgreSQL"),
    limit: int = Query(default=20, ge=1, le=200),
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> dict:
    try:
        dataset_record = get_dataset_record(db, session_record.id, dataset_id)
        return preview_dataset_record(dataset_record, limit=limit)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/predict", response_model=ForecastResponse)
def predict(
    payload: ForecastRequest,
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> ForecastResponse:
    try:
        touch_session_disease(db, session_record, payload.disease_slug)
        dataset_record = get_dataset_record(db, session_record.id, payload.dataset_id)
        request_payload = payload.model_dump()
        request_payload["state"] = resolve_dataset_state_query(dataset_record, payload.state)
        if dataset_record.frequency != "monthly" and request_payload["mode"] == "monthly":
            request_payload["mode"] = "auto"

        with temporary_dataset_path(dataset_record) as dataset_path:
            prediction_result = generate_forecast(
                dataset_path=dataset_path,
                state=request_payload["state"],
                mode=request_payload["mode"],
                model=payload.model,
                forecast_years=payload.forecast_years,
                forecast_periods=payload.forecast_periods,
                confidence=payload.confidence,
                seasonal=payload.seasonal,
            )

        saved_forecast = save_forecast_record(
            db=db,
            session_record=session_record,
            dataset_record=dataset_record,
            disease_slug=payload.disease_slug,
            request_payload=request_payload,
            prediction_payload=prediction_result,
        )
        return ForecastResponse(
            forecast_id=saved_forecast["forecast_id"],
            dataset_id=saved_forecast["dataset_id"],
            saved_at=saved_forecast["saved_at"],
            disease_slug=payload.disease_slug,
            **saved_forecast["result"],
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/export", response_model=DatasusExportResponse)
def export_from_datasus(
    payload: DatasusExportRequest,
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> DatasusExportResponse:
    export_result = None
    try:
        touch_session_disease(db, session_record, payload.disease_slug)
        export_result = run_datasus_export(payload)
        dataset_record = save_datasus_import(
            db=db,
            session_record=session_record,
            disease_slug=payload.disease_slug,
            disease_title=payload.disease_title,
            request_payload=payload.model_dump(),
            export_payload=export_result,
        )
        return DatasusExportResponse(
            dataset_id=dataset_record["dataset_id"],
            disease_slug=payload.disease_slug,
            dataset_name=export_result["dataset_name"],
            display_name=dataset_record["display_name"],
            tabnet_file_name=export_result["tabnet_file"],
            tidy_file_name=export_result["tidy_file"],
            preferred_file_name=dataset_record["file_name"],
            command=export_result["command"],
            resolved_rscript=export_result.get("resolved_rscript"),
            stdout=export_result.get("stdout", ""),
            stderr=export_result.get("stderr", ""),
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        if export_result and export_result.get("output_dir"):
            cleanup_export_output(export_result["output_dir"])


@router.get("/exports/history")
def exports_history(
    disease_slug: str | None = Query(default=None),
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> list[dict]:
    return list_session_exports(db, session_record.id, disease_slug=disease_slug)


@router.get("/results")
def processed_results(
    disease_slug: str | None = Query(default=None),
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> list[dict]:
    return list_session_forecasts(db, session_record.id, disease_slug=disease_slug)


@router.get("/results/{forecast_id}")
def processed_result_detail(
    forecast_id: str,
    db: Session = Depends(get_db),
    session_record: AppSession = Depends(get_current_session),
) -> dict:
    try:
        record = get_forecast_record(db, session_record.id, forecast_id)
        detail = forecast_to_detail(record)
        detail["disease_slug"] = record.disease_slug
        return detail
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=404, detail=str(exc)) from exc
