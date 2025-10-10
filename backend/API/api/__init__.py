from __future__ import annotations
from flask import Blueprint

# Apenas cria o blueprint. Não declare rotas aqui.
api_bp = Blueprint("api", __name__)

# Importa o módulo que contém TODAS as rotas.
from . import routes  # noqa: E402,F401

