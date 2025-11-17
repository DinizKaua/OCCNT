# backend/arima/theta.py
from __future__ import annotations

from typing import Any, Dict, List, Tuple

import numpy as np
import pandas as pd
from sktime.forecasting.base import ForecastingHorizon
from sktime.forecasting.theta import ThetaForecaster

# Reaproveitamos a mesma lógica de leitura/tratamento do ccnt2.py
from .ccnt2 import (
    _ler_header_bruto,
    _carregar_df_tabnet,
    _pick_estado,
    _serie_da_linha,
    _series_anuais,
)


def gerar_series_anuais(
    caminho_csv: str,
    estado: str,
    anos_previsao: int = 3,
    alpha: float = 0.95,
) -> Dict[str, Any]:
    """
    Gera séries anuais (histórico + previsão) usando ThetaForecaster (sktime),
    devolvendo o mesmo formato de JSON do ARIMA (ccnt2.gerar_series_anuais).
    """

    # 1) ler cabeçalho e detectar frequência (anual/mensal)
    colunas, header_idx, freq = _ler_header_bruto(caminho_csv)

    # 2) carregar DataFrame TABNET bruto
    df = _carregar_df_tabnet(caminho_csv, colunas, header_idx)

    # 3) selecionar a linha do estado
    estado_rotulo, linha = _pick_estado(df, estado)

    # 4) transformar linha em série temporal
    serie = _serie_da_linha(linha, freq)

    # 5) garantir agregação anual (se vier mensal soma por ano)
    serie_ano = _series_anuais(serie, freq)

    # 6) Ajuste do modelo Theta em log1p
    ts_log = np.log1p(serie_ano)
    fh = ForecastingHorizon(np.arange(1, anos_previsao + 1), is_relative=True)

    forecaster = ThetaForecaster(sp=1)
    forecaster.fit(ts_log)

    # previsão pontual em log
    y_pred_log = forecaster.predict(fh)

    # intervalos de previsão em log
    pred_int = forecaster.predict_interval(fh, coverage=[alpha])

    # === extrair colunas "lower"/"upper" de forma robusta ===
    cols = list(pred_int.columns)
    lower_col = None
    upper_col = None

    for c in cols:
        # c pode ser string ou tupla (MultiIndex)
        if isinstance(c, tuple):
            if "lower" in c and lower_col is None:
                lower_col = c
            if "upper" in c and upper_col is None:
                upper_col = c
        else:
            cs = str(c).lower()
            if "lower" in cs and lower_col is None:
                lower_col = c
            if "upper" in cs and upper_col is None:
                upper_col = c

    if lower_col is None or upper_col is None:
        raise RuntimeError(
            f"Não foi possível identificar colunas lower/upper em pred_int.columns={pred_int.columns}"
        )

    forecast_log = y_pred_log.to_numpy()
    lower = pred_int[lower_col].to_numpy()
    upper = pred_int[upper_col].to_numpy()
    conf_int_log = np.column_stack([lower, upper])

    # 7) desfaz log1p
    forecast = np.expm1(forecast_log)
    ci = np.expm1(conf_int_log)

    # 8) corta negativos em 0
    forecast = np.clip(forecast, 0, None)
    ci = np.clip(ci, 0, None)

    # 9) anos futuros
    last_year = int(serie_ano.index.max())
    anos_futuros = [last_year + i for i in range(1, anos_previsao + 1)]

    # monta dados_originais no mesmo formato do ARIMA
    dados_originais: List[Dict[str, float]] = [
        {"ano": int(a), "valor": float(v)} for a, v in serie_ano.items()
    ]

    # monta lista de previsões
    previsao: List[Dict[str, float]] = []
    for i in range(anos_previsao):
        previsao.append(
            {
                "ano": int(anos_futuros[i]),
                "valor": float(forecast[i]),
                "li": float(ci[i, 0]),
                "ls": float(ci[i, 1]),
            }
        )

    return {
        "frequencia_origem": freq,
        "estado_rotulo": estado_rotulo,
        "dados_originais": dados_originais,
        "previsao": previsao,
        "modelo": "ThetaForecaster (sktime)",
    }
