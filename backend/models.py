# backend/models.py
from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class PrevisaoRequest(BaseModel):
    categoria: str
    doenca: str
    tipo_dado: str
    estado: str = "21 Maranhão"
    anos_previsao: int = 3
    alpha: float = 0.95

class PontoSerie(BaseModel):
    ano: int
    valor: float

class PontoPrevisao(BaseModel):
    ano: int
    valor: float
    li: float
    ls: float

class PrevisaoResponse(BaseModel):
    frequencia_origem: str
    estado_rotulo: str
    dados_originais: List[PontoSerie]
    previsao: List[PontoPrevisao]
    modelo: str
