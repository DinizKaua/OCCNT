from __future__ import annotations
from flask import jsonify
from werkzeug.exceptions import HTTPException

def register_error_handlers(app):
    @app.errorhandler(HTTPException)
    def handle_http_error(err: HTTPException):
        return jsonify(ok=False, error=err.description, status=err.code), err.code

    @app.errorhandler(Exception)
    def handle_unexpected(err: Exception):
        # Em produção: logar stacktrace (Sentry/logging)
        return jsonify(ok=False, error="Erro interno do servidor.", status=500), 500

