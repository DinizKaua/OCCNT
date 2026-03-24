from __future__ import annotations

from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, Query, Request, UploadFile
from fastapi.templating import Jinja2Templates

from ..config import TEMPLATES_DIR
from ..schemas import DatasusExportRequest
from ..services.dataset_catalog import (
    get_dataset_info,
    list_dataset_files,
    preview_dataset,
    resolve_dataset_path,
    save_uploaded_dataset,
)
from ..services.datasus_export import list_export_jobs, run_datasus_export
from ..services.prediction_engine import generate_forecast
from ..services.processed_results import list_processed_results, load_processed_result, save_processed_result
from ..services.runtime_status import get_runtime_status
from ..ui_options import (
    CID_PROFILE_OPTIONS,
    CONFIDENCE_OPTIONS,
    FORECAST_PERIOD_OPTIONS,
    FORECAST_YEAR_OPTIONS,
    GRANULARITY_OPTIONS,
    MODE_OPTIONS,
    MODEL_OPTIONS,
    SEASONAL_OPTIONS,
    SYSTEM_OPTIONS,
    UF_OPTIONS,
    month_options,
    year_options,
)

router = APIRouter(tags=["dashboard"])
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))

TAB_EXPORT = "export"
TAB_PREDICT = "predict"
TAB_VIEW = "view"


@router.get("/")
def dashboard(
    request: Request,
    dataset_file: str = Query(default=""),
    result_file: str = Query(default=""),
    tab: str = Query(default=TAB_EXPORT),
):
    active_tab = _sanitize_tab(tab)
    prediction_result = None
    loaded_processed_result = None
    if result_file:
        try:
            loaded_processed_result = load_processed_result(result_file)
            prediction_result = loaded_processed_result.get("result")
            if not dataset_file:
                dataset_file = str(loaded_processed_result.get("dataset_file", ""))
            active_tab = TAB_VIEW
        except Exception:
            loaded_processed_result = None

    return _render_dashboard(
        request=request,
        active_tab=active_tab,
        selected_dataset=dataset_file,
        selected_result_file=result_file,
        prediction_result=prediction_result,
        loaded_processed_result=loaded_processed_result,
    )


@router.post("/dashboard/export")
def dashboard_export(
    request: Request,
    system: str = Form("SIM-DO"),
    uf: str = Form("MA"),
    year_start: int = Form(2018),
    year_end: int = Form(2022),
    granularity: str = Form("year"),
    month_start: int = Form(1),
    month_end: int = Form(12),
    cid_profile: str = Form(""),
    active_tab: str = Form(TAB_EXPORT),
):
    form_state = _default_form_state()
    form_state.update(
        {
            "export_system": system,
            "export_uf": uf,
            "export_year_start": year_start,
            "export_year_end": year_end,
            "export_granularity": granularity,
            "export_month_start": month_start,
            "export_month_end": month_end,
            "export_cid_profile": cid_profile,
        }
    )

    try:
        payload = DatasusExportRequest(
            system=system,
            uf=uf,
            year_start=year_start,
            year_end=year_end,
            granularity=granularity,  # type: ignore[arg-type]
            month_start=month_start,
            month_end=month_end,
            icd_prefix=cid_profile,
            dataset_name=None,
            rscript_bin="Rscript",
        )
        export_result = run_datasus_export(payload)
        selected_dataset = export_result["preferred_dataset_file"]
        preview = preview_dataset(selected_dataset, limit=15)
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            selected_dataset=selected_dataset,
            export_result=export_result,
            preview=preview,
            success_message="Importacao R concluida e dataset salvo no backend.",
            form_state=form_state,
        )
    except Exception as exc:
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            error_message=str(exc),
            form_state=form_state,
        )


@router.post("/dashboard/upload")
def dashboard_upload(
    request: Request,
    dataset_file: UploadFile = File(...),
    active_tab: str = Form(TAB_EXPORT),
):
    if not dataset_file.filename:
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            error_message="Upload falhou: arquivo sem nome.",
        )

    try:
        file_id = save_uploaded_dataset(dataset_file)
        preview = preview_dataset(file_id, limit=15)
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            selected_dataset=file_id,
            preview=preview,
            success_message="CSV enviado com sucesso para a base local.",
        )
    except Exception as exc:
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            error_message=str(exc),
        )


@router.post("/dashboard/predict")
def dashboard_predict(
    request: Request,
    dataset_file: str = Form(...),
    state_code: str = Form("21"),
    mode: str = Form("auto"),
    model: str = Form("arima"),
    forecast_years: int = Form(3),
    forecast_periods: int = Form(12),
    confidence: float = Form(0.95),
    seasonal_option: str = Form("auto"),
    active_tab: str = Form(TAB_PREDICT),
):
    if not dataset_file.strip():
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            error_message="Nenhum dataset foi selecionado para a previsao.",
        )

    seasonal = _parse_seasonal_option(seasonal_option)
    form_state = _default_form_state()
    form_state.update(
        {
            "predict_state_code": state_code,
            "predict_mode": mode,
            "predict_model": model,
            "predict_forecast_years": forecast_years,
            "predict_forecast_periods": forecast_periods,
            "predict_confidence": confidence,
            "predict_seasonal_option": seasonal_option,
        }
    )

    try:
        dataset_path = resolve_dataset_path(dataset_file)
        result = generate_forecast(
            dataset_path=dataset_path,
            state=state_code,
            mode=mode,
            model=model,
            forecast_years=forecast_years,
            forecast_periods=forecast_periods,
            confidence=confidence,
            seasonal=seasonal,
        )
        saved_result = save_processed_result(
            prediction_payload=result,
            dataset_file=dataset_file,
            request_params={
                "state": state_code,
                "mode": mode,
                "model": model,
                "forecast_years": forecast_years,
                "forecast_periods": forecast_periods,
                "confidence": confidence,
                "seasonal": seasonal,
            },
        )
        preview = preview_dataset(dataset_file, limit=15)
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            prediction_result=result,
            selected_dataset=dataset_file,
            selected_result_file=saved_result["result_file"],
            loaded_processed_result={
                "result_file": saved_result["result_file"],
                "saved_at": saved_result["saved_at"],
                "dataset_file": dataset_file,
                "request": {
                    "state": state_code,
                    "mode": mode,
                    "model": model,
                    "forecast_years": forecast_years,
                    "forecast_periods": forecast_periods,
                    "confidence": confidence,
                    "seasonal": seasonal,
                },
                "result": result,
            },
            preview=preview,
            success_message="Previsao executada e salva em resultados processados.",
            form_state=form_state,
        )
    except Exception as exc:
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            selected_dataset=dataset_file,
            error_message=str(exc),
            form_state=form_state,
        )


@router.post("/dashboard/datasets/select")
def dashboard_select_dataset(
    request: Request,
    dataset_file: str = Form(...),
    active_tab: str = Form(TAB_VIEW),
):
    try:
        preview = preview_dataset(dataset_file, limit=15)
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            selected_dataset=dataset_file,
            preview=preview,
            success_message="Dataset selecionado.",
        )
    except Exception as exc:
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            error_message=str(exc),
        )


@router.post("/dashboard/results/view")
def dashboard_view_processed_result(
    request: Request,
    result_file: str = Form(...),
    active_tab: str = Form(TAB_VIEW),
):
    try:
        loaded_result = load_processed_result(result_file)
        prediction_result = loaded_result.get("result", {})
        selected_dataset = str(loaded_result.get("dataset_file", ""))
        preview = preview_dataset(selected_dataset, limit=15) if selected_dataset else None
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            selected_dataset=selected_dataset,
            selected_result_file=result_file,
            prediction_result=prediction_result,
            loaded_processed_result=loaded_result,
            preview=preview,
            success_message="Resultado processado carregado.",
        )
    except Exception as exc:
        return _render_dashboard(
            request=request,
            active_tab=_sanitize_tab(active_tab),
            error_message=str(exc),
        )


def _render_dashboard(
    request: Request,
    active_tab: str = TAB_EXPORT,
    selected_dataset: str = "",
    selected_result_file: str = "",
    prediction_result: Optional[Dict[str, Any]] = None,
    export_result: Optional[Dict[str, Any]] = None,
    loaded_processed_result: Optional[Dict[str, Any]] = None,
    preview: Optional[Dict[str, Any]] = None,
    error_message: str = "",
    success_message: str = "",
    form_state: Optional[Dict[str, Any]] = None,
):
    datasets = list_dataset_files()
    export_jobs = list_export_jobs()
    processed_results = list_processed_results()
    runtime_status = get_runtime_status(datasets=datasets, exports=export_jobs, processed=processed_results)
    selected_dataset_info = None

    if not selected_dataset and datasets:
        selected_dataset = str(datasets[0]["file_id"])

    if selected_dataset:
        try:
            selected_dataset_info = get_dataset_info(selected_dataset)
        except Exception:
            selected_dataset_info = None

    if preview is None and selected_dataset:
        try:
            preview = preview_dataset(selected_dataset, limit=15)
        except Exception:
            preview = None

    active_form_state = _default_form_state()
    if form_state:
        active_form_state.update(form_state)
    if selected_result_file:
        active_form_state["selected_result_file"] = selected_result_file

    if loaded_processed_result:
        request_payload = loaded_processed_result.get("request", {})
        active_form_state["predict_state_code"] = str(request_payload.get("state", active_form_state["predict_state_code"]))
        active_form_state["predict_mode"] = str(request_payload.get("mode", active_form_state["predict_mode"]))
        active_form_state["predict_model"] = str(request_payload.get("model", active_form_state["predict_model"]))
        active_form_state["predict_forecast_years"] = int(
            request_payload.get("forecast_years", active_form_state["predict_forecast_years"])
        )
        active_form_state["predict_forecast_periods"] = int(
            request_payload.get("forecast_periods", active_form_state["predict_forecast_periods"])
        )
        active_form_state["predict_confidence"] = float(
            request_payload.get("confidence", active_form_state["predict_confidence"])
        )
        seasonal_from_request = request_payload.get("seasonal", None)
        active_form_state["predict_seasonal_option"] = "auto"
        if seasonal_from_request is True:
            active_form_state["predict_seasonal_option"] = "true"
        if seasonal_from_request is False:
            active_form_state["predict_seasonal_option"] = "false"

    context = {
        "request": request,
        "active_tab": _sanitize_tab(active_tab),
        "datasets": datasets,
        "export_jobs": export_jobs,
        "processed_results": processed_results,
        "runtime_status": runtime_status,
        "selected_dataset_info": selected_dataset_info,
        "selected_dataset": selected_dataset,
        "selected_result_file": selected_result_file,
        "prediction_result": prediction_result,
        "loaded_processed_result": loaded_processed_result,
        "export_result": export_result,
        "preview": preview,
        "has_datasets": bool(datasets),
        "has_processed_results": bool(processed_results),
        "error_message": error_message,
        "success_message": success_message,
        "form_state": active_form_state,
        "chart_payload": _build_line_chart_payload(prediction_result),
        "system_options": SYSTEM_OPTIONS,
        "uf_options": UF_OPTIONS,
        "state_options": [{"value": item["code"], "label": f"{item['code']} {item['name']}"} for item in UF_OPTIONS],
        "granularity_options": GRANULARITY_OPTIONS,
        "cid_profile_options": CID_PROFILE_OPTIONS,
        "year_options": year_options(start=2008),
        "month_options": month_options(),
        "mode_options": MODE_OPTIONS,
        "model_options": MODEL_OPTIONS,
        "confidence_options": CONFIDENCE_OPTIONS,
        "forecast_year_options": FORECAST_YEAR_OPTIONS,
        "forecast_period_options": FORECAST_PERIOD_OPTIONS,
        "seasonal_options": SEASONAL_OPTIONS,
    }
    return templates.TemplateResponse("dashboard.html", context)


def _default_form_state() -> Dict[str, Any]:
    return {
        "export_system": "SIM-DO",
        "export_uf": "MA",
        "export_year_start": 2018,
        "export_year_end": 2022,
        "export_granularity": "year",
        "export_month_start": 1,
        "export_month_end": 12,
        "export_cid_profile": "",
        "predict_state_code": "21",
        "predict_mode": "auto",
        "predict_model": "arima",
        "predict_forecast_years": 3,
        "predict_forecast_periods": 12,
        "predict_confidence": 0.95,
        "predict_seasonal_option": "auto",
        "selected_result_file": "",
    }


def _build_line_chart_payload(prediction_result: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not prediction_result:
        return {}
    historical = prediction_result.get("historical_data", [])
    forecast = prediction_result.get("forecast", [])
    time_key = "year" if prediction_result.get("output_frequency") == "annual" else "month"
    return {
        "labels": [str(item.get(time_key, "")) for item in historical + forecast],
        "historical": [float(item.get("value", 0.0)) for item in historical],
        "forecast": [float(item.get("value", 0.0)) for item in forecast],
        "lower": [float(item.get("lower", 0.0)) for item in forecast],
        "upper": [float(item.get("upper", 0.0)) for item in forecast],
        "split_index": max(len(historical) - 1, 0),
        "time_key": time_key,
    }


def _parse_seasonal_option(value: str) -> Optional[bool]:
    normalized = (value or "auto").strip().lower()
    if normalized == "auto":
        return None
    if normalized in ("true", "1", "yes", "sim", "on"):
        return True
    if normalized in ("false", "0", "no", "nao", "off"):
        return False
    return None


def _sanitize_tab(value: str) -> str:
    normalized = (value or TAB_EXPORT).strip().lower()
    if normalized in (TAB_EXPORT, TAB_PREDICT, TAB_VIEW):
        return normalized
    return TAB_EXPORT
