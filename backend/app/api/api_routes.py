from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from ..schemas import (
    DatasetInfo,
    DatasusExportRequest,
    DatasusExportResponse,
    ForecastRequest,
    ForecastResponse,
)
from ..services.dataset_catalog import list_dataset_files, preview_dataset, resolve_dataset_path, save_uploaded_dataset
from ..services.datasus_export import list_export_jobs, run_datasus_export
from ..services.prediction_engine import generate_forecast
from ..services.processed_results import list_processed_results, load_processed_result, save_processed_result
from ..services.runtime_status import get_runtime_status

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/health")
def health_check() -> dict:
    return {"status": "ok"}


@router.get("/runtime")
def runtime_status() -> dict:
    return get_runtime_status()


@router.get("/datasets", response_model=list[DatasetInfo])
def get_datasets() -> list[DatasetInfo]:
    return [DatasetInfo(**entry) for entry in list_dataset_files()]


@router.get("/datasets/preview")
def get_dataset_preview(
    file_id: str = Query(..., description="Relative CSV path under backend/data"),
    limit: int = Query(default=20, ge=1, le=200),
) -> dict:
    try:
        return preview_dataset(file_id=file_id, limit=limit)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/datasets/upload")
def upload_dataset(file: UploadFile = File(...)) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Upload must include a filename.")
    try:
        file_id = save_uploaded_dataset(file)
        return {"file_id": file_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/predict", response_model=ForecastResponse)
def predict(payload: ForecastRequest) -> ForecastResponse:
    try:
        dataset_path = resolve_dataset_path(payload.dataset_file)
        result = generate_forecast(
            dataset_path=dataset_path,
            state=payload.state,
            mode=payload.mode,
            model=payload.model,
            forecast_years=payload.forecast_years,
            forecast_periods=payload.forecast_periods,
            confidence=payload.confidence,
            seasonal=payload.seasonal,
        )
        save_processed_result(
            prediction_payload=result,
            dataset_file=payload.dataset_file,
            request_params=payload.model_dump(),
        )
        return ForecastResponse(**result)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/export", response_model=DatasusExportResponse)
def export_from_datasus(payload: DatasusExportRequest) -> DatasusExportResponse:
    try:
        export_result = run_datasus_export(payload)
        return DatasusExportResponse(**export_result)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/exports/history")
def exports_history() -> list[dict]:
    return list_export_jobs()


@router.get("/results")
def processed_results() -> list[dict]:
    return list_processed_results()


@router.get("/results/{result_file}")
def processed_result_detail(result_file: str) -> dict:
    try:
        return load_processed_result(result_file)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
