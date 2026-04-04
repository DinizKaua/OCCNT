from __future__ import annotations

from typing import Tuple

import numpy as np
from pmdarima import auto_arima


def forecast_arima_log(
    series_log: np.ndarray,
    periods: int,
    confidence: float,
    seasonal: bool,
    season_length: int,
) -> Tuple[np.ndarray, np.ndarray]:
    series_length = int(len(series_log))
    max_order = max(1, min(3, series_length // 2))
    model = auto_arima(
        series_log,
        seasonal=seasonal,
        m=season_length if seasonal else 1,
        D=0,
        start_p=0,
        start_q=0,
        max_p=max_order,
        max_q=max_order,
        stepwise=True,
        suppress_warnings=True,
        trace=False,
    )

    forecast_log, confidence_log = model.predict(
        n_periods=int(periods),
        return_conf_int=True,
        alpha=1 - confidence,
    )
    return np.asarray(forecast_log), np.asarray(confidence_log)

