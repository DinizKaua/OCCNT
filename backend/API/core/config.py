# core/config.py
import os

def load_config():
    """
    Retorna um dicionário básico de configuração para o Flask.
    """
    return {
        # chave usada pelo Flask para sessões seguras
        "SECRET_KEY": os.getenv("SECRET_KEY", "dev"),

        # ativa modo debug para mostrar erros no console
        "DEBUG": True
    }