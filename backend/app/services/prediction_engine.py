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
    "theta": "ThetaForecaster",
}


def get_available_model_options() -> list[dict[str, str]]:
    return [
        {"value": "arima", "label": "ARIMA"},
        {"value": "theta", "label": "Theta"},
    ]


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
    available_models = {item["value"] for item in get_available_model_options()}
    if normalized_model not in MODEL_LABELS or normalized_model not in available_models:
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
    display_series = _prepare_display_series(series)
    training_series = _prepare_series(display_series)
    _validate_series(training_series, minimum_points=4, label="Serie anual")
    use_robust_mode = len(training_series) < 7

    if use_robust_mode:
        forecast_values, interval_values = _build_fallback_forecast(training_series, int(years))
        model_label = f"{MODEL_LABELS[model_name]} (modo robusto)"
    else:
        try:
            forecast_values, interval_values = _annual_model_forecast(
                series=training_series,
                model_name=model_name,
                years=years,
                confidence=confidence,
            )
        except Exception as exc:
            raise RuntimeError(f"Falha ao ajustar o modelo {MODEL_LABELS[model_name]} para a serie anual: {exc}") from exc

        forecast_values, interval_values = _normalize_forecast_output(training_series, forecast_values, interval_values)
        if _annual_backtest_prefers_baseline(training_series, model_name, confidence):
            forecast_values, interval_values = _build_fallback_forecast(training_series, int(years))
            model_label = f"{MODEL_LABELS[model_name]} (modo robusto)"
        else:
            model_label = MODEL_LABELS[model_name]

    last_displayed_year = int(pd.Index(display_series.index).astype(int).max())
    future_years = [last_displayed_year + offset for offset in range(1, int(years) + 1)]

    historical_data = [
        {"year": int(year), "value": float(value)}
        for year, value in zip(pd.Index(display_series.index).astype(int), display_series.values)
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
        "model": model_label,
        "historical_points": int(len(historical_data)),
        "forecast_points": int(len(forecast_data)),
        "last_observed": float(display_series.iloc[-1]),
        "peak_observed": float(display_series.max()),
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

    display_series = _prepare_display_series(series)
    ordered_series = _prepare_series(display_series)
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
    forecast_values, interval_values = _normalize_forecast_output(ordered_series, forecast_values, interval_values)

    last_period = pd.Timestamp(display_series.index.max())
    future_periods = pd.date_range(
        last_period + pd.offsets.MonthBegin(1),
        periods=int(periods),
        freq="MS",
    )

    historical_data = [
        {"month": month.strftime("%Y-%m"), "value": float(value)}
        for month, value in zip(display_series.index, display_series.values)
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
        "last_observed": float(display_series.iloc[-1]),
        "peak_observed": float(display_series.max()),
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


def _prepare_series(series: pd.Series) -> pd.Series:
    cleaned = series.astype(float).sort_index()
    trimmed = _trim_trailing_zeros(cleaned)
    return trimmed if len(trimmed) else cleaned


def _prepare_display_series(series: pd.Series) -> pd.Series:
    return _prepare_series(series)


def _trim_trailing_zeros(series: pd.Series) -> pd.Series:
    if series.empty:
        return series

    trimmed = series.copy()
    while len(trimmed) > 4 and float(trimmed.iloc[-1]) == 0.0 and float(trimmed.iloc[:-1].max()) > 0.0:
        trimmed = trimmed.iloc[:-1]

    return trimmed


def _normalize_forecast_output(
    series: pd.Series,
    forecast_values: np.ndarray,
    interval_values: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    values = np.asarray(forecast_values, dtype=float)
    intervals = np.asarray(interval_values, dtype=float)

    if _forecast_is_suspicious(series, values):
        values, intervals = _build_fallback_forecast(series, len(values))

    intervals[:, 0] = np.minimum(intervals[:, 0], values)
    intervals[:, 1] = np.maximum(intervals[:, 1], values)
    return values, intervals


def _annual_model_forecast(
    series: pd.Series,
    model_name: str,
    years: int,
    confidence: float,
) -> tuple[np.ndarray, np.ndarray]:
    series_log = np.log1p(series.to_numpy())

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

    forecast_values = np.clip(np.expm1(np.asarray(forecast_log)), 0, None)
    interval_values = np.clip(np.expm1(np.asarray(interval_log)), 0, None)
    return forecast_values, interval_values


def _forecast_is_suspicious(series: pd.Series, forecast_values: np.ndarray) -> bool:
    values = np.asarray(forecast_values, dtype=float)
    if values.size == 0 or not np.isfinite(values).all():
        return True

    recent = series.astype(float).tail(min(5, len(series)))
    reference = max(float(recent.median()), float(recent.iloc[-1]), 1.0)
    max_value = float(np.nanmax(values))
    min_value = float(np.nanmin(values))
    forecast_spread = max_value - min_value
    recent_range = float(recent.max() - recent.min()) if len(recent) else 0.0

    if max_value <= 0:
        return True
    if max_value > reference * 25:
        return True
    if max_value < reference * 0.05 and reference > 100:
        return True
    if forecast_spread <= max(reference * 0.005, 1.0) and recent_range >= max(reference * 0.03, 15.0):
        return True
    return False


def _annual_backtest_prefers_baseline(
    series: pd.Series,
    model_name: str,
    confidence: float,
) -> bool:
    holdout = min(2, len(series) - 4)
    if holdout < 1:
        return False

    model_errors = []
    baseline_errors = []
    for step in range(holdout, 0, -1):
        train = series.iloc[:-step]
        actual = float(series.iloc[-step])

        try:
            model_forecast, _ = _annual_model_forecast(train, model_name, years=1, confidence=confidence)
            model_errors.append(abs(actual - float(model_forecast[0])))
        except Exception:
            return True

        baseline_forecast, _ = _build_fallback_forecast(train, 1)
        baseline_errors.append(abs(actual - float(baseline_forecast[0])))

    model_mae = float(np.mean(model_errors)) if model_errors else float("inf")
    baseline_mae = float(np.mean(baseline_errors)) if baseline_errors else float("inf")
    return not np.isfinite(model_mae) or baseline_mae + max(5.0, baseline_mae * 0.15) < model_mae


def _build_fallback_forecast(series: pd.Series, periods: int) -> tuple[np.ndarray, np.ndarray]:
    recent = series.astype(float).tail(min(5, len(series)))
    last_value = float(recent.iloc[-1])
    diffs = np.diff(recent.to_numpy(dtype=float)) if len(recent) > 1 else np.asarray([0.0])
    median_diff = float(np.median(diffs)) if diffs.size else 0.0
    linear_slope = float(np.polyfit(np.arange(len(recent)), recent.to_numpy(dtype=float), 1)[0]) if len(recent) > 1 else 0.0
    slope = (median_diff + linear_slope) / 2
    if abs(slope) < max(last_value * 0.005, 5.0) and len(recent) > 1:
        slope = ((float(recent.iloc[-1]) - float(recent.iloc[0])) / max(len(recent) - 1, 1)) * 0.6
    slope = float(np.clip(slope, -max(last_value * 0.18, 60.0), max(last_value * 0.18, 60.0)))
    uncertainty = max(float(np.std(diffs)) if diffs.size else 0.0, max(last_value * 0.08, 1.0))

    values = []
    intervals = []
    for index in range(periods):
        point = max(last_value + slope * (index + 1), last_value * 0.35, 0.0)
        band = uncertainty * (index + 1)
        values.append(point)
        intervals.append([max(point - band, 0.0), point + band])

    return np.asarray(values, dtype=float), np.asarray(intervals, dtype=float)
