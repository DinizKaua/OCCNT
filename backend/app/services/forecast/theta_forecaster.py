from __future__ import annotations

from typing import Tuple

import numpy as np
import pandas as pd

Z_TABLE = {
    0.80: 1.2816,
    0.85: 1.4395,
    0.90: 1.6449,
    0.95: 1.96,
    0.97: 2.1701,
    0.98: 2.3263,
    0.99: 2.5758,
}


def forecast_theta_log(
    series_log: pd.Series,
    periods: int,
    confidence: float,
    season_length: int,
) -> Tuple[np.ndarray, np.ndarray]:
    try:
        from sktime.forecasting.base import ForecastingHorizon
        from sktime.forecasting.theta import ThetaForecaster
    except Exception:
        return _forecast_theta_fallback(series_log, periods, confidence, season_length)

    forecasting_horizon = ForecastingHorizon(np.arange(1, int(periods) + 1), is_relative=True)
    forecaster = ThetaForecaster(sp=int(season_length))
    forecaster.fit(series_log)
    forecast_log = forecaster.predict(forecasting_horizon)

    try:
        interval_df = forecaster.predict_interval(forecasting_horizon, coverage=[confidence])
        lower_column = None
        upper_column = None
        for column in interval_df.columns:
            if isinstance(column, tuple):
                if "lower" in column and lower_column is None:
                    lower_column = column
                if "upper" in column and upper_column is None:
                    upper_column = column
            else:
                column_str = str(column).lower()
                if "lower" in column_str and lower_column is None:
                    lower_column = column
                if "upper" in column_str and upper_column is None:
                    upper_column = column
        if lower_column is None or upper_column is None:
            raise RuntimeError("Could not detect lower/upper interval columns from sktime output.")
        interval_log = np.column_stack(
            [np.asarray(interval_df[lower_column]), np.asarray(interval_df[upper_column])]
        )
        return np.asarray(forecast_log), interval_log
    except Exception:
        return _forecast_theta_fallback(series_log, periods, confidence, season_length)


def _z_for_confidence(confidence: float) -> float:
    options = sorted(Z_TABLE.keys())
    nearest = min(options, key=lambda item: abs(item - confidence))
    return Z_TABLE[nearest]


def _forecast_theta_fallback(
    series_log: pd.Series,
    periods: int,
    confidence: float,
    season_length: int,
) -> Tuple[np.ndarray, np.ndarray]:
    values = pd.Series(series_log, dtype=float).dropna()
    if values.empty:
        raise RuntimeError("Theta fallback requires at least one observation.")

    deseasonalized, seasonal_pattern = _deseasonalize(values, season_length)
    ses_level, alpha = _fit_simple_exp_smoothing(deseasonalized.to_numpy(dtype=float))

    n_obs = len(deseasonalized)
    time_index = np.arange(1, n_obs + 1, dtype=float)
    slope, intercept = np.polyfit(time_index, deseasonalized.to_numpy(dtype=float), 1) if n_obs > 1 else (0.0, float(deseasonalized.iloc[-1]))

    forecasts = []
    for step in range(1, int(periods) + 1):
        theta_line = intercept + slope * (n_obs + step)
        ses_component = ses_level
        point = max((theta_line + ses_component) / 2, deseasonalized.iloc[-1] * 0.35)
        point *= seasonal_pattern[(step - 1) % len(seasonal_pattern)]
        forecasts.append(point)

    point_values = np.asarray(forecasts, dtype=float)

    fitted = _ses_fitted_values(deseasonalized.to_numpy(dtype=float), alpha)
    residuals = deseasonalized.to_numpy(dtype=float) - fitted
    sigma = max(float(np.nanstd(residuals)) if np.isfinite(residuals).any() else 0.0, 1e-6)
    z_value = _z_for_confidence(confidence)
    lower = []
    upper = []
    for step, value in enumerate(point_values, start=1):
        band = z_value * sigma * np.sqrt(step)
        seasonal = seasonal_pattern[(step - 1) % len(seasonal_pattern)]
        lower.append(max(value - band * seasonal, 1e-9))
        upper.append(value + band * seasonal)

    return point_values, np.column_stack([np.asarray(lower, dtype=float), np.asarray(upper, dtype=float)])


def _fit_simple_exp_smoothing(values: np.ndarray) -> tuple[float, float]:
    if len(values) == 1:
        return float(values[0]), 0.5

    best_alpha = 0.5
    best_level = float(values[0])
    best_error = float("inf")
    for alpha in np.linspace(0.1, 0.9, 17):
        level = float(values[0])
        error = 0.0
        for value in values[1:]:
            error += (float(value) - level) ** 2
            level = alpha * float(value) + (1 - alpha) * level
        if error < best_error:
            best_error = error
            best_alpha = float(alpha)
            best_level = float(level)

    return best_level, best_alpha


def _ses_fitted_values(values: np.ndarray, alpha: float) -> np.ndarray:
    fitted = np.empty_like(values, dtype=float)
    level = float(values[0])
    fitted[0] = level
    for index in range(1, len(values)):
        fitted[index] = level
        level = alpha * float(values[index]) + (1 - alpha) * level
    return fitted


def _deseasonalize(series_log: pd.Series, season_length: int) -> tuple[pd.Series, np.ndarray]:
    if season_length <= 1 or len(series_log) < season_length * 2:
        return series_log.astype(float), np.ones(1, dtype=float)

    pattern_values = np.ones(season_length, dtype=float)
    usable = series_log.to_numpy(dtype=float)
    groups = [[] for _ in range(season_length)]
    for index, value in enumerate(usable):
        groups[index % season_length].append(float(value))

    overall_mean = float(np.mean(usable)) if len(usable) else 1.0
    for index, group in enumerate(groups):
        if group:
            pattern_values[index] = max(float(np.mean(group)) / max(overall_mean, 1e-9), 1e-6)

    pattern_values = pattern_values / np.mean(pattern_values)
    adjusted = [float(value) / pattern_values[index % season_length] for index, value in enumerate(usable)]
    return pd.Series(adjusted, index=series_log.index, dtype=float), pattern_values

