# backend/models.py
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class PrevisaoRequest(BaseModel):
    categoria: str
    doenca: str
    tipo_dado: str
    estado: str = "21 Maranhão"

    # NOVO: auto/anual/mensal + arima/theta
    modo: str = "anual"
    modelo: str = "arima"

    # horizonte
    anos_previsao: int = 3
    periodos_previsao: int = 12  # útil no mensal

    alpha: float = 0.95
    seasonal: Optional[bool] = None  # no mensal


class PrevisaoResponse(BaseModel):
    # deixa flexível para anual (ano) e mensal (mes)
    frequencia_origem: str
    frequencia_saida: Optional[str] = None
    estado_rotulo: str
    dados_originais: List[Dict[str, Any]]
    previsao: List[Dict[str, Any]]
    modelo: str
