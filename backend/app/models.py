from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_id() -> str:
    return str(uuid4())


class AppSession(Base):
    __tablename__ = "app_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    last_disease_slug: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    datasets: Mapped[list["DatasetImport"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    forecasts: Mapped[list["ForecastRun"]] = relationship(back_populates="session", cascade="all, delete-orphan")


class DatasetImport(Base):
    __tablename__ = "dataset_imports"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    session_id: Mapped[str] = mapped_column(ForeignKey("app_sessions.id", ondelete="CASCADE"), index=True)
    disease_slug: Mapped[str] = mapped_column(String(128), index=True)
    disease_title: Mapped[str] = mapped_column(String(255))
    source_group: Mapped[str] = mapped_column(String(64), default="datasus")
    dataset_name: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(255))
    system: Mapped[str] = mapped_column(String(32))
    uf: Mapped[str] = mapped_column(String(8))
    year_start: Mapped[int] = mapped_column(Integer)
    year_end: Mapped[int] = mapped_column(Integer)
    month_start: Mapped[int] = mapped_column(Integer)
    month_end: Mapped[int] = mapped_column(Integer)
    granularity: Mapped[str] = mapped_column(String(32))
    icd_prefix: Mapped[str] = mapped_column(Text, default="")
    preferred_kind: Mapped[str] = mapped_column(String(16), default="tidy")
    tabnet_file_name: Mapped[str] = mapped_column(String(255))
    tidy_file_name: Mapped[str] = mapped_column(String(255))
    preferred_file_name: Mapped[str] = mapped_column(String(255))
    tabnet_content: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    tidy_content: Mapped[Optional[bytes]] = mapped_column(LargeBinary, nullable=True)
    layout: Mapped[str] = mapped_column(String(64), default="unknown")
    frequency: Mapped[str] = mapped_column(String(64), default="unknown")
    size_kb: Mapped[float] = mapped_column(Float, default=0.0)
    command_payload: Mapped[Optional[list[str]]] = mapped_column(JSONB, nullable=True)
    resolved_rscript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    stdout_text: Mapped[str] = mapped_column(Text, default="")
    stderr_text: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    session: Mapped[AppSession] = relationship(back_populates="datasets")
    forecasts: Mapped[list["ForecastRun"]] = relationship(back_populates="dataset", cascade="all, delete-orphan")


class ForecastRun(Base):
    __tablename__ = "forecast_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True, default=generate_id)
    session_id: Mapped[str] = mapped_column(ForeignKey("app_sessions.id", ondelete="CASCADE"), index=True)
    dataset_id: Mapped[str] = mapped_column(ForeignKey("dataset_imports.id", ondelete="CASCADE"), index=True)
    disease_slug: Mapped[str] = mapped_column(String(128), index=True)
    request_payload: Mapped[dict] = mapped_column(JSONB)
    result_payload: Mapped[dict] = mapped_column(JSONB)
    model_label: Mapped[str] = mapped_column(String(255))
    output_frequency: Mapped[str] = mapped_column(String(32))
    state_label: Mapped[str] = mapped_column(String(255))
    historical_count: Mapped[int] = mapped_column(Integer, default=0)
    forecast_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    session: Mapped[AppSession] = relationship(back_populates="forecasts")
    dataset: Mapped[DatasetImport] = relationship(back_populates="forecasts")
