from __future__ import annotations

from threading import Lock

from fastapi import HTTPException
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    pass


engine = create_engine(
    DATABASE_URL,
    future=True,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False, class_=Session)

_schema_lock = Lock()
_schema_ready = False


def ensure_database_schema() -> None:
    global _schema_ready
    if _schema_ready:
        return

    with _schema_lock:
        if _schema_ready:
            return

        from . import models  # noqa: F401

        Base.metadata.create_all(bind=engine)
        _schema_ready = True


def get_db():
    try:
        ensure_database_schema()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail=f"Banco de dados indisponivel: {exc}") from exc

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> tuple[bool, str]:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True, ""
    except Exception as exc:  # noqa: BLE001
        return False, str(exc)
