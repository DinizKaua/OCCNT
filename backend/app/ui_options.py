from __future__ import annotations

from datetime import datetime
from typing import Dict, List

UF_OPTIONS: List[Dict[str, str]] = [
    {"sigla": "AC", "code": "12", "name": "Acre"},
    {"sigla": "AL", "code": "27", "name": "Alagoas"},
    {"sigla": "AP", "code": "16", "name": "Amapa"},
    {"sigla": "AM", "code": "13", "name": "Amazonas"},
    {"sigla": "BA", "code": "29", "name": "Bahia"},
    {"sigla": "CE", "code": "23", "name": "Ceara"},
    {"sigla": "DF", "code": "53", "name": "Distrito Federal"},
    {"sigla": "ES", "code": "32", "name": "Espirito Santo"},
    {"sigla": "GO", "code": "52", "name": "Goias"},
    {"sigla": "MA", "code": "21", "name": "Maranhao"},
    {"sigla": "MT", "code": "51", "name": "Mato Grosso"},
    {"sigla": "MS", "code": "50", "name": "Mato Grosso do Sul"},
    {"sigla": "MG", "code": "31", "name": "Minas Gerais"},
    {"sigla": "PA", "code": "15", "name": "Para"},
    {"sigla": "PB", "code": "25", "name": "Paraiba"},
    {"sigla": "PR", "code": "41", "name": "Parana"},
    {"sigla": "PE", "code": "26", "name": "Pernambuco"},
    {"sigla": "PI", "code": "22", "name": "Piaui"},
    {"sigla": "RJ", "code": "33", "name": "Rio de Janeiro"},
    {"sigla": "RN", "code": "24", "name": "Rio Grande do Norte"},
    {"sigla": "RS", "code": "43", "name": "Rio Grande do Sul"},
    {"sigla": "RO", "code": "11", "name": "Rondonia"},
    {"sigla": "RR", "code": "14", "name": "Roraima"},
    {"sigla": "SC", "code": "42", "name": "Santa Catarina"},
    {"sigla": "SP", "code": "35", "name": "Sao Paulo"},
    {"sigla": "SE", "code": "28", "name": "Sergipe"},
    {"sigla": "TO", "code": "17", "name": "Tocantins"},
]

SYSTEM_OPTIONS: List[Dict[str, str]] = [
    {"value": "SIM-DO", "label": "SIM-DO (Obitos consolidados)"},
    {"value": "SIM-DO-PRELIM", "label": "SIM-DO-PRELIM (Obitos preliminares)"},
    {"value": "SIH-RD", "label": "SIH-RD (Internacoes)"},
]

GRANULARITY_OPTIONS: List[Dict[str, str]] = [
    {"value": "year", "label": "Anual"},
    {"value": "month", "label": "Mensal"},
]

MODEL_OPTIONS: List[Dict[str, str]] = [
    {"value": "arima", "label": "ARIMA"},
    {"value": "theta", "label": "Theta"},
]

MODE_OPTIONS: List[Dict[str, str]] = [
    {"value": "auto", "label": "Auto"},
    {"value": "annual", "label": "Anual"},
    {"value": "monthly", "label": "Mensal"},
]

SEASONAL_OPTIONS: List[Dict[str, str]] = [
    {"value": "auto", "label": "Auto"},
    {"value": "true", "label": "Ativar"},
    {"value": "false", "label": "Desativar"},
]

CONFIDENCE_OPTIONS: List[float] = [0.8, 0.85, 0.9, 0.95, 0.97, 0.99]

FORECAST_YEAR_OPTIONS: List[int] = [1, 2, 3, 4, 5, 7, 10, 15]
FORECAST_PERIOD_OPTIONS: List[int] = [3, 6, 12, 18, 24, 36, 48]

CID_PROFILE_OPTIONS: List[Dict[str, str]] = [
    {"value": "", "label": "Sem filtro CID"},
    {"value": "I", "label": "Cardiovasculares (I)"},
    {"value": "I10,I11,I12,I13,I14,I15", "label": "Hipertensao (I10-I15)"},
    {"value": "E10,E11,E12,E13,E14", "label": "Diabetes (E10-E14)"},
    {"value": "J40,J41,J42,J43,J44,J45,J46,J47", "label": "Respiratorias cronicas (J40-J47)"},
    {"value": "C,D0,D1,D2,D3,D4", "label": "Cancer e neoplasias (C, D0-D4)"},
    {"value": "N18,N19", "label": "Doenca renal cronica (N18-N19)"},
]


def year_options(start: int = 2000, end: int | None = None) -> List[int]:
    if end is None:
        end = datetime.utcnow().year
    return list(range(start, end + 1))


def month_options() -> List[int]:
    return list(range(1, 13))

