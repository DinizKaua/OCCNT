from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

ForecastMode = Literal["auto", "annual", "monthly"]
ForecastModel = Literal["arima", "theta"]
DataGranularity = Literal["year", "month"]


class ForecastRequest(BaseModel):
    dataset_file: str = Field(..., description="Relative path under backend/data")
    state: str = Field(default="21", description="UF code, sigla or name")
    mode: ForecastMode = "auto"
    model: ForecastModel = "arima"
    forecast_years: int = 3
    forecast_periods: int = 12
    confidence: float = 0.95
    seasonal: Optional[bool] = None

    @field_validator("forecast_years", "forecast_periods")
    @classmethod
    def validate_positive_horizon(cls, value: int) -> int:
        if value < 1:
            raise ValueError("Forecast horizon must be >= 1.")
        return value

    @field_validator("confidence")
    @classmethod
    def validate_confidence(cls, value: float) -> float:
        if not 0.5 <= value <= 0.999:
            raise ValueError("confidence must be between 0.5 and 0.999.")
        return value


class ForecastResponse(BaseModel):
    source_frequency: str
    output_frequency: str
    state_label: str
    historical_data: List[Dict[str, Any]]
    forecast: List[Dict[str, Any]]
    model: str
    seasonal: Optional[bool] = None
    season_length: Optional[int] = None
    historical_points: Optional[int] = None
    forecast_points: Optional[int] = None
    last_observed: Optional[float] = None
    peak_observed: Optional[float] = None


class DatasetInfo(BaseModel):
    file_id: str
    file_name: str
    display_name: Optional[str] = None
    source_group: str
    layout: str
    frequency: str
    size_kb: float
    updated_at: str


class DatasusExportRequest(BaseModel):
    system: str = "SIM-DO"
    uf: str = "MA"
    year_start: int = 2018
    year_end: int = 2022
    granularity: DataGranularity = "year"
    month_start: int = 1
    month_end: int = 12
    icd_prefix: str = ""
    dataset_name: Optional[str] = None
    rscript_bin: str = "Rscript"

    @field_validator("uf")
    @classmethod
    def validate_uf(cls, value: str) -> str:
        if len(value.strip()) != 2:
            raise ValueError("UF must use two-letter sigla, e.g. MA.")
        return value.strip().upper()

    @field_validator("year_end")
    @classmethod
    def validate_year_range(cls, value: int, info) -> int:  # type: ignore[override]
        year_start = info.data.get("year_start", value)
        if value < year_start:
            raise ValueError("year_end cannot be lower than year_start.")
        return value

    @field_validator("month_start", "month_end")
    @classmethod
    def validate_month_range(cls, value: int) -> int:
        if value < 1 or value > 12:
            raise ValueError("month must be between 1 and 12.")
        return value


class DatasusExportResponse(BaseModel):
    dataset_name: str
    output_dir: str
    tabnet_file: str
    tidy_file: str
    preferred_dataset_file: str
    command: List[str]
    resolved_rscript: Optional[str] = None
    stdout: str
    stderr: str
