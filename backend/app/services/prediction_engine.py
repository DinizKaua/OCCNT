from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from .forecast.arima_forecaster import forecast_arima_log
from .forecast.csv_loader import (
    aggregate_to_annual,
    detect_source_frequency,
    load_state_series,
)
from .forecast.theta_forecaster import forecast_theta_log

MODEL_LABELS = {
    "arima": "ARIMA (auto_arima)",
    "theta": "ThetaForecaster (sktime)",
}


def generate_forecast(
    dataset_path: Path,
    state: str,
    mode: str = "auto",
    model: str = "arima",
    forecast_years: int = 3,
    forecast_periods: int = 12,
    confidence: float = 0.95,
    seasonal: Optional[bool] = None,
) -> Dict[str, Any]:
    normalized_model = (model or "arima").strip().lower()
    if normalized_model not in MODEL_LABELS:
        raise ValueError("model must be 'arima' or 'theta'.")

    source_frequency = detect_source_frequency(dataset_path)
    output_mode = _resolve_output_mode(mode, source_frequency)

    series, state_label, loaded_frequency = load_state_series(dataset_path, state)
    if loaded_frequency != source_frequency:
        source_frequency = loaded_frequency

    if output_mode == "monthly":
        if source_frequency != "monthly":
            raise ValueError("Monthly forecast requires a monthly source dataset.")
        return _forecast_monthly(
            series=series,
            state_label=state_label,
            model_name=normalized_model,
            periods=forecast_periods,
            confidence=confidence,
            seasonal=seasonal,
        )

    annual_series = aggregate_to_annual(series) if source_frequency == "monthly" else series
    return _forecast_annual(
        series=annual_series,
        state_label=state_label,
        source_frequency=source_frequency,
        model_name=normalized_model,
        years=forecast_years,
        confidence=confidence,
    )


def _resolve_output_mode(mode: str, source_frequency: str) -> str:
    normalized_mode = (mode or "auto").strip().lower()
    if normalized_mode not in ("auto", "annual", "monthly"):
        raise ValueError("mode must be auto, annual or monthly.")
    if normalized_mode == "auto":
        return "monthly" if source_frequency == "monthly" else "annual"
    return normalized_mode


def _forecast_annual(
    series: pd.Series,
    state_label: str,
    source_frequency: str,
    model_name: str,
    years: int,
    confidence: float,
) -> Dict[str, Any]:
    series = series.astype(float).sort_index()
    _validate_series(series, minimum_points=4, label="Serie anual")
    series_log = np.log1p(series.to_numpy())

    try:
        if model_name == "arima":
            forecast_log, interval_log = forecast_arima_log(
                series_log=series_log,
                periods=years,
                confidence=confidence,
                seasonal=False,
                season_length=1,
            )
        else:
            log_series = pd.Series(series_log, index=pd.Index(series.index).astype(int))
            forecast_log, interval_log = forecast_theta_log(
                series_log=log_series,
                periods=years,
                confidence=confidence,
                season_length=1,
            )
    except Exception as exc:
        raise RuntimeError(f"Falha ao ajustar o modelo {MODEL_LABELS[model_name]} para a serie anual: {exc}") from exc

    forecast_values = np.clip(np.expm1(np.asarray(forecast_log)), 0, None)
    interval_values = np.clip(np.expm1(np.asarray(interval_log)), 0, None)

    last_year = int(pd.Index(series.index).astype(int).max())
    future_years = [last_year + offset for offset in range(1, int(years) + 1)]

    historical_data = [
        {"year": int(year), "value": float(value)}
        for year, value in zip(pd.Index(series.index).astype(int), series.values)
    ]
    forecast_data = []
    for index in range(int(years)):
        forecast_data.append(
            {
                "year": int(future_years[index]),
                "value": float(forecast_values[index]),
                "lower": float(interval_values[index, 0]),
                "upper": float(interval_values[index, 1]),
            }
        )

    return {
        "source_frequency": source_frequency,
        "output_frequency": "annual",
        "state_label": state_label,
        "historical_data": historical_data,
        "forecast": forecast_data,
        "model": MODEL_LABELS[model_name],
        "historical_points": int(len(historical_data)),
        "forecast_points": int(len(forecast_data)),
        "last_observed": float(series.iloc[-1]),
        "peak_observed": float(series.max()),
    }


def _forecast_monthly(
    series: pd.Series,
    state_label: str,
    model_name: str,
    periods: int,
    confidence: float,
    seasonal: Optional[bool],
) -> Dict[str, Any]:
    if not isinstance(series.index, pd.DatetimeIndex):
        raise ValueError("Monthly source series is invalid.")

    ordered_series = series.astype(float).sort_index()
    _validate_series(ordered_series, minimum_points=6, label="Serie mensal")
    seasonal_requested = True if seasonal is None else bool(seasonal)
    seasonal_enabled = seasonal_requested and len(ordered_series) >= 24
    season_length = 12 if seasonal_enabled else 1
    series_log = np.log1p(ordered_series.to_numpy())

    try:
        if model_name == "arima":
            forecast_log, interval_log = forecast_arima_log(
                series_log=series_log,
                periods=periods,
                confidence=confidence,
                seasonal=seasonal_enabled,
                season_length=season_length,
            )
        else:
            period_index = pd.PeriodIndex(ordered_series.index, freq="M")
            log_series = pd.Series(series_log, index=period_index)
            forecast_log, interval_log = forecast_theta_log(
                series_log=log_series,
                periods=periods,
                confidence=confidence,
                season_length=season_length,
            )
    except Exception as exc:
        raise RuntimeError(f"Falha ao ajustar o modelo {MODEL_LABELS[model_name]} para a serie mensal: {exc}") from exc

    forecast_values = np.clip(np.expm1(np.asarray(forecast_log)), 0, None)
    interval_values = np.clip(np.expm1(np.asarray(interval_log)), 0, None)

    last_period = pd.Timestamp(ordered_series.index.max())
    future_periods = pd.date_range(
        last_period + pd.offsets.MonthBegin(1),
        periods=int(periods),
        freq="MS",
    )

    historical_data = [
        {"month": month.strftime("%Y-%m"), "value": float(value)}
        for month, value in zip(ordered_series.index, ordered_series.values)
    ]
    forecast_data = []
    for index in range(int(periods)):
        forecast_data.append(
            {
                "month": future_periods[index].strftime("%Y-%m"),
                "value": float(forecast_values[index]),
                "lower": float(interval_values[index, 0]),
                "upper": float(interval_values[index, 1]),
            }
        )

    return {
        "source_frequency": "monthly",
        "output_frequency": "monthly",
        "state_label": state_label,
        "historical_data": historical_data,
        "forecast": forecast_data,
        "model": MODEL_LABELS[model_name],
        "seasonal": bool(seasonal_enabled),
        "season_length": int(season_length),
        "historical_points": int(len(historical_data)),
        "forecast_points": int(len(forecast_data)),
        "last_observed": float(ordered_series.iloc[-1]),
        "peak_observed": float(ordered_series.max()),
    }


def _validate_series(series: pd.Series, minimum_points: int, label: str) -> None:
    cleaned = series.dropna().astype(float)
    if len(cleaned) < minimum_points:
        raise ValueError(f"{label} precisa ter pelo menos {minimum_points} observacoes validas.")

    values = cleaned.to_numpy(dtype=float)
    if not np.isfinite(values).all():
        raise ValueError(f"{label} contem valores nao numericos ou infinitos.")

    if float(np.abs(values).sum()) == 0.0:
        raise ValueError(f"{label} contem apenas zeros; nao ha base estatistica para previsao.")
