# backend/arima/theta.py
from __future__ import annotations

from typing import Any, Dict

from .ccnt3 import gerar_series_anuais as _anuais
from .ccnt3 import gerar_series_mensais as _mensais


def gerar_series_anuais(
    caminho_csv: str,
    estado: str,
    anos_previsao: int = 3,
    alpha: float = 0.95,
) -> Dict[str, Any]:
    return _anuais(
        caminho_csv=caminho_csv,
        estado=estado,
        anos_previsao=anos_previsao,
        alpha=alpha,
        modelo="theta",
    )


def gerar_series_mensais(
    caminho_csv: str,
    estado: str,
    periodos_previsao: int = 12,
    alpha: float = 0.95,
    seasonal: bool = True,
) -> Dict[str, Any]:
    return _mensais(
        caminho_csv=caminho_csv,
        estado=estado,
        periodos_previsao=periodos_previsao,
        alpha=alpha,
        seasonal=seasonal,
        modelo="theta",
    )
