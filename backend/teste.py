import json
import os
import tempfile
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from arima import ccnt3

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_DIR = os.path.join(BASE_DIR, "json")


def _listar_jsons() -> List[str]:
    if not os.path.isdir(JSON_DIR):
        return []
    nomes = [
        f
        for f in os.listdir(JSON_DIR)
        if f.lower().endswith(".json") and os.path.isfile(os.path.join(JSON_DIR, f))
    ]
    return sorted(nomes)


def _safe_json_path(nome: str) -> str:
    base = os.path.basename(nome)
    if base != nome or "/" in nome or "\\" in nome:
        raise HTTPException(status_code=400, detail="Nome de arquivo invalido.")
    if not base.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="O arquivo deve terminar com .json.")
    return os.path.join(JSON_DIR, base)


def _parse_seasonal(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    v = value.strip().lower()
    if v in ("1", "true", "t", "yes", "y", "sim"):
        return True
    if v in ("0", "false", "f", "no", "n", "nao", "não"):
        return False
    raise HTTPException(status_code=400, detail="seasonal deve ser true/false.")


def _detectar_modo_auto(csv_path: str, enc: str, fmt: str, freq: str) -> str:
    if fmt == "tidy":
        df = pd.read_csv(csv_path, encoding=enc, sep=";", dtype=str)
        freq = ccnt3._detectar_freq_tidy(df)
    return "mensal" if freq == "mensal" else "anual"


@router.get("/teste/jsons")
def listar_jsons():
    return {"arquivos": _listar_jsons()}


@router.get("/teste/jsons/{nome}")
def obter_json(nome: str):
    caminho = _safe_json_path(nome)
    if not os.path.exists(caminho):
        raise HTTPException(status_code=404, detail="JSON nao encontrado.")
    try:
        with open(caminho, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"JSON invalido: {type(e).__name__}: {repr(e)}",
        )


@router.post("/teste/prever/csv")
async def prever_csv(
    file: UploadFile = File(...),
    estado: str = Form("21 Maranhão"),
    modo: str = Form("auto"),
    anos_previsao: int = Form(3),
    periodos_previsao: int = Form(12),
    alpha: float = Form(0.95),
    seasonal: Optional[str] = Form(None),
):
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo .csv.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Arquivo CSV vazio.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".csv") as tmp:
        tmp.write(raw)
        tmp_path = tmp.name

    try:
        fmt, freq, enc, _ = ccnt3._detect_format_and_freq(tmp_path)
        modo_in = modo.strip().lower()
        if modo_in not in ("auto", "anual", "mensal"):
            raise HTTPException(status_code=400, detail="modo deve ser auto/anual/mensal.")

        if modo_in == "auto":
            modo_final = _detectar_modo_auto(tmp_path, enc, fmt, freq)
        else:
            modo_final = modo_in

        seasonal_bool = _parse_seasonal(seasonal)
        if modo_final == "mensal":
            payload = ccnt3.gerar_series_mensais(
                tmp_path,
                estado,
                periodos_previsao=int(periodos_previsao),
                alpha=float(alpha),
                seasonal=True if seasonal_bool is None else seasonal_bool,
            )
        else:
            payload = ccnt3.gerar_series_anuais(
                tmp_path,
                estado,
                anos_previsao=int(anos_previsao),
                alpha=float(alpha),
            )
        return payload
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass
