# backend/main.py
import json
import os
import traceback
from typing import Dict

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models import PrevisaoRequest, PrevisaoResponse
from arima import ccnt3
from teste import router as teste_router

app = FastAPI(title="API ARIMA/THETA Doenças")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(teste_router)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
JSON_DIR = os.path.join(BASE_DIR, "json")
OUT_MENSAL_PATH = os.path.join(JSON_DIR, "out_mensal.json")

CATEGORIAS: Dict[str, Dict] = {
    "sepse": {
        "descricao": "Doenças e condições relacionadas à sepse.",
        "doencas": {
            "Óbitos por Sepse": {
                "tipos_dado": {
                    "principal": os.path.join(DATA_DIR, "Obitos_Sepse.csv")
                }
            },
            "Respiradores Artificiais por Sepse": {
                "tipos_dado": {
                    "principal": os.path.join(
                        DATA_DIR,
                        "RespiradoresArtificiais_Sepse.csv",
                    )
                }
            },
        },
    }
}


def _modo_auto_por_csv(caminho_csv: str) -> str:
    fmt, freq, enc, _ = ccnt3._detect_format_and_freq(caminho_csv)
    if fmt == "tidy":
        df = pd.read_csv(caminho_csv, encoding=enc, sep=";", dtype=str)
        freq = ccnt3._detectar_freq_tidy(df)
    return "mensal" if freq == "mensal" else "anual"


@app.get("/categorias")
def listar_categorias():
    return [
        {
            "nome": nome,
            "descricao": dados.get("descricao", ""),
            "total_doencas": len(dados.get("doencas", {})),
        }
        for nome, dados in CATEGORIAS.items()
    ]


@app.get("/categorias/{categoria}/doencas")
def listar_doencas(categoria: str):
    if categoria not in CATEGORIAS:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")
    doencas = CATEGORIAS[categoria]["doencas"]
    return [
        {
            "nome": nome,
            "tipos_dado": list(info.get("tipos_dado", {}).keys()),
        }
        for nome, info in doencas.items()
    ]


@app.post("/prever", response_model=PrevisaoResponse)
def prever(req: PrevisaoRequest):
    if req.categoria not in CATEGORIAS:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    cat = CATEGORIAS[req.categoria]
    if req.doenca not in cat["doencas"]:
        raise HTTPException(status_code=404, detail="Doença não encontrada na categoria")

    doenca = cat["doencas"][req.doenca]
    if req.tipo_dado not in doenca["tipos_dado"]:
        raise HTTPException(status_code=404, detail="Tipo de dado não encontrado para essa doença")

    caminho_csv = doenca["tipos_dado"][req.tipo_dado]
    if not os.path.exists(caminho_csv):
        raise HTTPException(status_code=500, detail=f"CSV não encontrado no servidor: {caminho_csv}")

    modo = (req.modo or "anual").strip().lower()
    if modo not in ("auto", "anual", "mensal"):
        raise HTTPException(status_code=400, detail="modo deve ser auto/anual/mensal.")

    modelo = (req.modelo or "arima").strip().lower()
    if modelo not in ("arima", "theta"):
        raise HTTPException(status_code=400, detail="modelo deve ser arima/theta.")

    try:
        if modo == "auto":
            modo_final = _modo_auto_por_csv(caminho_csv)
        else:
            modo_final = modo

        if modo_final == "mensal":
            seasonal = True if req.seasonal is None else bool(req.seasonal)
            resultado = ccnt3.gerar_series_mensais(
                caminho_csv,
                req.estado,
                periodos_previsao=int(req.periodos_previsao),
                alpha=float(req.alpha),
                seasonal=seasonal,
                modelo=modelo,
            )
        else:
            resultado = ccnt3.gerar_series_anuais(
                caminho_csv,
                req.estado,
                anos_previsao=int(req.anos_previsao),
                alpha=float(req.alpha),
                modelo=modelo,
            )

        return resultado

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar previsão: {type(e).__name__}: {repr(e)}",
        )


@app.post("/prever/theta", response_model=PrevisaoResponse)
def prever_theta(req: PrevisaoRequest):
    # compat: mantém rota antiga, mas força modelo=theta
    req.modelo = "theta"
    return prever(req)


@app.get("/prever/mensal")
def prever_mensal():
    # compat: mantém rota antiga de JSON salvo
    if not os.path.exists(OUT_MENSAL_PATH):
        raise HTTPException(
            status_code=404,
            detail=f"Arquivo JSON mensal não encontrado: {OUT_MENSAL_PATH}",
        )
    try:
        with open(OUT_MENSAL_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"JSON mensal inválido: {type(e).__name__}: {repr(e)}",
        )
