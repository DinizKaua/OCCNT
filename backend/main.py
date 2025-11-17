# backend/main.py
import os
import traceback
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict

from models import PrevisaoRequest, PrevisaoResponse
from arima.ccnt2 import gerar_series_anuais
from arima.theta import gerar_series_anuais as gerar_series_anuais_theta

app = FastAPI(title="API ARIMA Doenças")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

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
        raise HTTPException(
            status_code=404,
            detail="Doença não encontrada na categoria",
        )

    doenca = cat["doencas"][req.doenca]
    if req.tipo_dado not in doenca["tipos_dado"]:
        raise HTTPException(
            status_code=404,
            detail="Tipo de dado não encontrado para essa doença",
        )

    caminho_csv = doenca["tipos_dado"][req.tipo_dado]
    if not os.path.exists(caminho_csv):
        raise HTTPException(
            status_code=500,
            detail=f"CSV não encontrado no servidor: {caminho_csv}",
        )

    try:
        resultado = gerar_series_anuais(
            caminho_csv=caminho_csv,
            estado=req.estado,
            anos_previsao=req.anos_previsao,
            alpha=req.alpha,
        )
        return resultado
    except Exception as e:
        # isso vai aparecer no terminal
        traceback.print_exc()

        # isso vai aparecer no navegador
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar previsão: {type(e).__name__}: {repr(e)}",
        )


@app.post("/prever/theta", response_model=PrevisaoResponse)
def prever_theta(req: PrevisaoRequest):
    if req.categoria not in CATEGORIAS:
        raise HTTPException(status_code=404, detail="Categoria não encontrada")

    cat = CATEGORIAS[req.categoria]
    if req.doenca not in cat["doencas"]:
        raise HTTPException(
            status_code=404,
            detail="Doença não encontrada na categoria",
        )

    doenca = cat["doencas"][req.doenca]
    if req.tipo_dado not in doenca["tipos_dado"]:
        raise HTTPException(
            status_code=404,
            detail="Tipo de dado não encontrado para essa doença",
        )

    caminho_csv = doenca["tipos_dado"][req.tipo_dado]
    if not os.path.exists(caminho_csv):
        raise HTTPException(
            status_code=500,
            detail=f"CSV não encontrado no servidor: {caminho_csv}",
        )

    try:
        resultado = gerar_series_anuais_theta(
            caminho_csv=caminho_csv,
            estado=req.estado,
            anos_previsao=req.anos_previsao,
            alpha=req.alpha,
        )
        return resultado
    except Exception as e:
        # isso vai aparecer no terminal
        traceback.print_exc()

        # isso vai aparecer no navegador
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao gerar previsão (Theta): {type(e).__name__}: {repr(e)}",
        )
