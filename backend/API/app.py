from __future__ import annotations
from flask import Flask
from flask_cors import CORS
import os

from core.config import load_config
from core.errors import register_error_handlers
from api import api_bp

def create_app() -> Flask:
    app = Flask(__name__)
    app.config.update(load_config())

    # CORS: em produção, troque "*" por seu domínio (ex.: https://meufront.app)
    CORS(app, resources={r"/api/*": {"origins": os.getenv("ALLOW_CORS_ORIGINS", "*")}})

    # Blueprint raiz da API
    app.register_blueprint(api_bp, url_prefix="/api/v1")

    # Handlers de erro padronizados (JSON)
    register_error_handlers(app)
    return app

if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=5000, debug=True)

