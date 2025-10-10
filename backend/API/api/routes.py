from __future__ import annotations
from flask import request, jsonify, abort

from . import api_bp
from core.store import (
    listar_categorias,
    obter_categoria_por_slug,
    listar_doencas_por_categoria,
    listar_doencas,
    obter_doenca_por_slug,
    obter_series,
)

# ----------------------------------------------------------------------
# HEALTH
# ----------------------------------------------------------------------
@api_bp.get("/health")
def health():
    return jsonify(ok=True, status="healthy")

# ----------------------------------------------------------------------
# CATEGORIAS
# ----------------------------------------------------------------------
@api_bp.get("/categorias")
def get_categorias():
    data = listar_categorias()
    return jsonify(ok=True, total=len(data), data=data)

@api_bp.get("/categorias/<slug>")
def get_categoria(slug: str):
    cat = obter_categoria_por_slug(slug)
    if not cat:
        abort(404, description="Categoria não encontrada.")
    # inclui doenças da categoria para montar a UI “Observatório”
    doencas = listar_doencas_por_categoria(slug)
    return jsonify(ok=True, data={
        "id": cat["id"],
        "slug": cat["slug"],
        "nome": cat["nome"],
        "descricao_longa": cat["descricao_longa"],
        "doencas": doencas,
    })

# ----------------------------------------------------------------------
# DOENÇAS
# ----------------------------------------------------------------------
@api_bp.get("/doencas")
def get_doencas():
    """
    Lista doenças. Filtro opcional por categoria (?categoria=cardiovasculares).
    """
    categoria = (request.args.get("categoria") or "").strip()
    data = listar_doencas(categoria_slug=categoria if categoria else None)
    return jsonify(ok=True, total=len(data), data=data)

@api_bp.get("/doencas/<slug>")
def get_doenca(slug: str):
    d = obter_doenca_por_slug(slug)
    if not d:
        abort(404, description="Doença não encontrada.")
    return jsonify(ok=True, data={
        "slug": d["slug"],
        "nome": d["nome"],
        "categoria": d["categoria_slug"],
        "descricao": d["descricao"],
        "tipos_de_dado": d["tipos_de_dado"],
    })

# ----------------------------------------------------------------------
# SÉRIES (dados originais + previsão)
# ----------------------------------------------------------------------
@api_bp.get("/doencas/<slug>/series")
def get_series(slug: str):
    """
    Retorna série original + previsão (mock) no formato para o gráfico.
    Query params:
      - tipo   : obitos | internacoes | incidencia   (default: obitos)
      - modelo : arima  | auto_arima  | holtwinters  (default: arima)
    """
    tipo = (request.args.get("tipo") or "obitos").strip().lower()
    modelo = (request.args.get("modelo") or "arima").strip().lower()

    d = obter_doenca_por_slug(slug)
    if not d:
        abort(404, description="Doença não encontrada.")

    if tipo not in d["tipos_de_dado"]:
        abort(400, description=f"Tipo '{tipo}' indisponível para esta doença.")

    try:
        payload = obter_series(doenca_slug=slug, tipo=tipo, modelo=modelo)
    except KeyError:
        abort(404, description="Doença não encontrada.")
    except ValueError as e:
        abort(400, description=str(e))
    except Exception:
        abort(500, description="Falha ao gerar série.")

    return jsonify(ok=True, **payload)

