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
    except Exception as exc:
        raise RuntimeError(
            "Theta model requires sktime. Install dependencies with backend/requirements.txt."
        ) from exc

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
        residual_sigma = _estimate_sigma(series_log, forecaster)
        z_value = _z_for_confidence(confidence)
        point_values = np.asarray(forecast_log)
        lower = point_values - z_value * residual_sigma
        upper = point_values + z_value * residual_sigma
        return point_values, np.column_stack([lower, upper])


def _estimate_sigma(series_log: pd.Series, forecaster) -> float:
    try:
        in_sample = forecaster.predict_in_sample().reindex(series_log.index)
        residuals = (series_log - in_sample).to_numpy()
        if np.isfinite(residuals).any():
            sigma = float(np.nanstd(residuals))
            return max(sigma, 1e-9)
    except Exception:
        pass

    if len(series_log) > 2:
        diffs = np.diff(series_log.to_numpy())
        if np.isfinite(diffs).any():
            sigma = float(np.nanstd(diffs))
            return max(sigma, 1e-9)
    return 1e-6


def _z_for_confidence(confidence: float) -> float:
    options = sorted(Z_TABLE.keys())
    nearest = min(options, key=lambda item: abs(item - confidence))
    return Z_TABLE[nearest]

