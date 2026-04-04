from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re
from typing import Dict, List, Optional, Tuple

import pandas as pd

MONTH_ALIAS_MAP = {
    "JAN": "Jan",
    "FEV": "Feb",
    "MAR": "Mar",
    "ABR": "Apr",
    "MAI": "May",
    "JUN": "Jun",
    "JUL": "Jul",
    "AGO": "Aug",
    "SET": "Sep",
    "OUT": "Oct",
    "NOV": "Nov",
    "DEZ": "Dec",
    "JANUARY": "Jan",
    "FEBRUARY": "Feb",
    "MARCH": "Mar",
    "APRIL": "Apr",
    "MAY": "May",
    "JUNE": "Jun",
    "JULY": "Jul",
    "AUGUST": "Aug",
    "SEPTEMBER": "Sep",
    "OCTOBER": "Oct",
    "NOVEMBER": "Nov",
    "DECEMBER": "Dec",
}


@dataclass(frozen=True)
class CsvMetadata:
    layout: str
    source_frequency: str
    encoding: str
    header_index: Optional[int] = None


def _read_lines(path: Path) -> Tuple[List[str], str]:
    for encoding in ("utf-8-sig", "utf-8", "ISO-8859-1", "cp1252"):
        try:
            with path.open("r", encoding=encoding) as handle:
                return handle.read().splitlines(), encoding
        except UnicodeDecodeError:
            continue
    with path.open("r", encoding="utf-8", errors="replace") as handle:
        return handle.read().splitlines(), "utf-8"


def _normalize_month_headers(cells: List[str]) -> List[str]:
    normalized: List[str] = []
    for raw in cells:
        cell = raw.replace('"', "").strip()
        month_match = re.fullmatch(r"(\d{4})/([A-Za-z]{3,})", cell)
        if month_match:
            year_value, month_raw = month_match.groups()
            alias = MONTH_ALIAS_MAP.get(month_raw[:3].upper(), month_raw[:3].title())
            normalized.append(f"{year_value}/{alias}")
            continue
        normalized.append(cell)
    return normalized


def _detect_tabnet_header_index(lines: List[str], max_scan: int = 100) -> Optional[int]:
    for index, line in enumerate(lines[:max_scan]):
        if "Unidade da Federa" in line and re.search(r"\b\d{4}\b", line):
            return index
    return None


def _detect_frequency_from_headers(headers: List[str]) -> str:
    period_headers = [item.strip().strip('"') for item in headers[1:]]
    if period_headers and all(re.fullmatch(r"\d{4}", value) for value in period_headers):
        return "annual"
    if period_headers and all(re.fullmatch(r"\d{4}/[A-Za-z]{3}", value) for value in period_headers):
        return "monthly"
    raise ValueError("CSV header is not recognized as annual or monthly.")


def _detect_tidy_frequency(df: pd.DataFrame) -> str:
    granularity_column = _column_name(df, ["granularidade", "granularity"])
    if granularity_column:
        values = (
            df[granularity_column]
            .dropna()
            .astype(str)
            .str.strip()
            .str.lower()
            .unique()
            .tolist()
        )
        if len(values) == 1:
            if values[0] in ("mensal", "monthly", "month"):
                return "monthly"
            if values[0] in ("anual", "annual", "year"):
                return "annual"

    period_column = _column_name(df, ["periodo", "period"])
    if period_column is None:
        raise ValueError("Tidy CSV must include a 'periodo' column.")

    periods = df[period_column].dropna().astype(str).str.strip()
    if periods.empty:
        raise ValueError("Unable to infer frequency from empty periodo column.")
    if periods.str.fullmatch(r"\d{4}").all():
        return "annual"
    if periods.str.fullmatch(r"\d{4}/[A-Za-z]{3,}").all() or periods.str.fullmatch(r"\d{4}[-/]\d{2}").all():
        return "monthly"
    raise ValueError("Could not infer annual/monthly frequency from periodo column.")


def detect_csv_metadata(csv_path: Path) -> CsvMetadata:
    lines, encoding = _read_lines(csv_path)
    header_index = _detect_tabnet_header_index(lines)
    if header_index is not None:
        headers = _normalize_month_headers(lines[header_index].split(";"))
        frequency = _detect_frequency_from_headers(headers)
        return CsvMetadata(
            layout="tabnet",
            source_frequency=frequency,
            encoding=encoding,
            header_index=header_index,
        )

    if not lines:
        raise ValueError(f"CSV file is empty: {csv_path}")
    header_cells = [item.strip().strip('"').lower() for item in lines[0].split(";")]
    if "periodo" in header_cells and "valor" in header_cells:
        return CsvMetadata(layout="tidy", source_frequency="auto", encoding=encoding)

    raise ValueError(
        "CSV layout not supported. Expected TABNET wide format or tidy CSV with periodo/valor columns."
    )


def detect_source_frequency(csv_path: Path) -> str:
    metadata = detect_csv_metadata(csv_path)
    if metadata.layout == "tabnet":
        return metadata.source_frequency
    df = pd.read_csv(csv_path, sep=";", encoding=metadata.encoding, dtype=str)
    df.columns = [item.strip().strip('"') for item in df.columns]
    return _detect_tidy_frequency(df)


def load_state_series(csv_path: Path, state_query: str) -> Tuple[pd.Series, str, str]:
    metadata = detect_csv_metadata(csv_path)

    if metadata.layout == "tabnet":
        if metadata.header_index is None:
            raise ValueError("TABNET CSV header index was not detected.")
        frame = _load_tabnet_dataframe(csv_path, metadata.encoding, metadata.header_index)
        state_label, row = _pick_tabnet_state(frame, state_query)
        series = _tabnet_row_to_series(row, metadata.source_frequency, frame.columns[0])
        return series, state_label, metadata.source_frequency

    frame = _load_tidy_dataframe(csv_path, metadata.encoding)
    source_frequency = _detect_tidy_frequency(frame)
    state_label, selected_frame = _pick_tidy_state(frame, state_query)
    series = _tidy_frame_to_series(selected_frame, source_frequency)
    return series, state_label, source_frequency


def aggregate_to_annual(series: pd.Series) -> pd.Series:
    if isinstance(series.index, pd.DatetimeIndex):
        aggregated = series.groupby(series.index.year).sum().sort_index()
    else:
        index_year = pd.Index(series.index).astype(int)
        aggregated = pd.Series(series.values, index=index_year, name=series.name).sort_index()
        aggregated = aggregated.groupby(level=0).sum()

    full_years = pd.RangeIndex(int(aggregated.index.min()), int(aggregated.index.max()) + 1)
    return aggregated.reindex(full_years).fillna(0.0)


def preview_dataframe(csv_path: Path, limit: int = 20) -> pd.DataFrame:
    metadata = detect_csv_metadata(csv_path)
    if metadata.layout == "tabnet":
        if metadata.header_index is None:
            raise ValueError("Unable to preview TABNET file without header index.")
        frame = _load_tabnet_dataframe(csv_path, metadata.encoding, metadata.header_index)
        return frame.head(limit)

    frame = _load_tidy_dataframe(csv_path, metadata.encoding)
    return frame.head(limit)


def detect_period_bounds(csv_path: Path) -> Dict[str, int]:
    metadata = detect_csv_metadata(csv_path)
    if metadata.layout == "tabnet":
        if metadata.header_index is None:
            raise ValueError("TABNET CSV header index was not detected.")
        frame = _load_tabnet_dataframe(csv_path, metadata.encoding, metadata.header_index)
        if metadata.source_frequency == "annual":
            years = [int(re.search(r"(\d{4})", str(column)).group(1)) for column in frame.columns[1:]]  # type: ignore[union-attr]
            return {
                "year_start": min(years),
                "year_end": max(years),
                "month_start": 1,
                "month_end": 12,
            }
        months = _parse_month_index(pd.Series(frame.columns[1:], dtype=str))
        return {
            "year_start": int(months.min().year),
            "year_end": int(months.max().year),
            "month_start": int(months.min().month),
            "month_end": int(months.max().month),
        }

    frame = _load_tidy_dataframe(csv_path, metadata.encoding)
    source_frequency = _detect_tidy_frequency(frame)
    period_column = _column_name(frame, ["periodo", "period"])
    if period_column is None:
        raise ValueError("Tidy CSV must include a periodo column.")

    if source_frequency == "annual":
        years = pd.to_numeric(frame[period_column].astype(str).str.extract(r"(\d{4})")[0], errors="coerce").dropna().astype(int)
        return {
            "year_start": int(years.min()),
            "year_end": int(years.max()),
            "month_start": 1,
            "month_end": 12,
        }

    months = _parse_month_index(frame[period_column].astype(str))
    return {
        "year_start": int(months.min().year),
        "year_end": int(months.max().year),
        "month_start": int(months.min().month),
        "month_end": int(months.max().month),
    }


def _load_tabnet_dataframe(csv_path: Path, encoding: str, header_index: int) -> pd.DataFrame:
    lines, _ = _read_lines(csv_path)
    headers = _normalize_month_headers(lines[header_index].split(";"))
    frame = pd.read_csv(
        csv_path,
        encoding=encoding,
        sep=";",
        header=None,
        skiprows=header_index + 1,
        dtype=str,
    )
    frame.columns = [item.strip().strip('"') for item in headers]
    state_column = frame.columns[0]
    frame = frame[frame[state_column].astype(str).str.match(r"^\d{2}\s")]
    return frame


def _load_tidy_dataframe(csv_path: Path, encoding: str) -> pd.DataFrame:
    frame = pd.read_csv(csv_path, sep=";", encoding=encoding, dtype=str)
    frame.columns = [item.strip().strip('"') for item in frame.columns]
    return frame


def _pick_tabnet_state(frame: pd.DataFrame, state_query: str) -> Tuple[str, pd.Series]:
    state_column = frame.columns[0]
    query = (state_query or "").strip().lower()
    if not query:
        row = frame.iloc[0]
        return str(row[state_column]), row

    exact_mask = frame[state_column].astype(str).str.lower() == query
    if exact_mask.any():
        row = frame[exact_mask].iloc[0]
        return str(row[state_column]), row

    code_match = re.match(r"^(\d{2})\b", query)
    if code_match:
        code = code_match.group(1)
        code_mask = frame[state_column].astype(str).str.startswith(f"{code} ")
        if code_mask.any():
            row = frame[code_mask].iloc[0]
            return str(row[state_column]), row

    contains_mask = frame[state_column].astype(str).str.lower().str.contains(query, regex=False)
    if contains_mask.any():
        row = frame[contains_mask].iloc[0]
        return str(row[state_column]), row

    raise ValueError(f"State '{state_query}' was not found in the selected CSV.")


def _pick_tidy_state(frame: pd.DataFrame, state_query: str) -> Tuple[str, pd.DataFrame]:
    query = (state_query or "").strip()
    code_column = _column_name(frame, ["uf_codigo", "state_code"])
    sigla_column = _column_name(frame, ["uf_sigla", "state_abbrev"])
    name_column = _column_name(frame, ["uf_nome", "state_name"])

    if code_column is None and sigla_column is None and name_column is None:
        return "dataset", frame

    if query:
        code_match = re.match(r"^(\d{2})\b", query)
        if code_match and code_column is not None:
            code = code_match.group(1)
            selected = frame[frame[code_column].astype(str).str.strip() == code]
            if not selected.empty:
                return _build_state_label(selected, code_column, name_column), selected

        if len(query) == 2 and sigla_column is not None:
            selected = frame[frame[sigla_column].astype(str).str.upper() == query.upper()]
            if not selected.empty:
                return _build_state_label(selected, code_column, name_column), selected

        if name_column is not None:
            selected = frame[frame[name_column].astype(str).str.lower().str.contains(query.lower(), regex=False)]
            if not selected.empty:
                return _build_state_label(selected, code_column, name_column), selected

    if code_column is not None:
        first_code = frame[code_column].astype(str).dropna().unique().tolist()
        if len(first_code) == 1:
            selected = frame[frame[code_column].astype(str) == first_code[0]]
            return _build_state_label(selected, code_column, name_column), selected

    return "dataset", frame


def _build_state_label(frame: pd.DataFrame, code_column: Optional[str], name_column: Optional[str]) -> str:
    code = ""
    name = ""
    if code_column is not None:
        code = str(frame.iloc[0][code_column]).strip()
    if name_column is not None:
        name = str(frame.iloc[0][name_column]).strip()
    return f"{code} {name}".strip() or "dataset"


def _tabnet_row_to_series(row: pd.Series, source_frequency: str, state_column: str) -> pd.Series:
    period_values = row.drop(labels=[state_column]).astype(str).str.replace('"', "", regex=False).str.strip()
    numeric_values = _to_numeric(period_values)

    if source_frequency == "annual":
        years = [int(re.search(r"(\d{4})", label).group(1)) for label in numeric_values.index]  # type: ignore[arg-type]
        series = pd.Series(numeric_values.values, index=pd.Index(years), name="value").sort_index()
        full_years = pd.RangeIndex(int(series.index.min()), int(series.index.max()) + 1)
        return series.reindex(full_years).fillna(0.0)

    monthly_index = _parse_month_index(pd.Series(numeric_values.index, dtype=str))
    monthly_series = pd.Series(numeric_values.values, index=monthly_index, name="value").sort_index()
    full_months = pd.date_range(monthly_series.index.min(), monthly_series.index.max(), freq="MS")
    return monthly_series.reindex(full_months).fillna(0.0)


def _tidy_frame_to_series(frame: pd.DataFrame, source_frequency: str) -> pd.Series:
    period_column = _column_name(frame, ["periodo", "period"])
    value_column = _column_name(frame, ["valor", "value"])
    if period_column is None or value_column is None:
        raise ValueError("Tidy CSV must include periodo and valor columns.")

    numeric_values = _to_numeric(frame[value_column].astype(str))

    if source_frequency == "annual":
        years = pd.to_numeric(frame[period_column].astype(str).str.extract(r"(\d{4})")[0], errors="coerce")
        series = pd.Series(numeric_values.values, index=years.astype(int), name="value")
        series = series.groupby(level=0).sum().sort_index()
        full_years = pd.RangeIndex(int(series.index.min()), int(series.index.max()) + 1)
        return series.reindex(full_years).fillna(0.0)

    monthly_index = _parse_month_index(frame[period_column].astype(str))
    series = pd.Series(numeric_values.values, index=monthly_index, name="value")
    series = series.groupby(level=0).sum().sort_index()
    full_months = pd.date_range(series.index.min(), series.index.max(), freq="MS")
    return series.reindex(full_months).fillna(0.0)


def _parse_month_index(values: pd.Series) -> pd.DatetimeIndex:
    raw = values.astype(str).str.replace('"', "", regex=False).str.strip()
    numeric_pattern = raw.str.fullmatch(r"\d{4}[-/]\d{2}")
    if numeric_pattern.all():
        normalized = raw.str.replace("/", "-", regex=False) + "-01"
        parsed = pd.to_datetime(normalized, format="%Y-%m-%d", errors="raise")
        return pd.DatetimeIndex(parsed).to_period("M").to_timestamp(how="start")

    normalized = raw.str.replace(
        r"^(\d{4})/([A-Za-z]{3,})$",
        lambda match: f"{match.group(1)}/{MONTH_ALIAS_MAP.get(match.group(2)[:3].upper(), match.group(2)[:3].title())}",
        regex=True,
    )
    parsed = pd.to_datetime(normalized, format="%Y/%b", errors="raise")
    return pd.DatetimeIndex(parsed).to_period("M").to_timestamp(how="start")


def _to_numeric(values: pd.Series) -> pd.Series:
    cleaned = values.astype(str).str.replace('"', "", regex=False).str.strip()
    normalized = cleaned.map(_normalize_numeric_text)
    return pd.to_numeric(normalized, errors="coerce").fillna(0.0).astype(float)


def _normalize_numeric_text(value: str) -> str:
    text = str(value).strip()
    if not text:
        return ""

    if "," in text and "." in text:
        if text.rfind(",") > text.rfind("."):
            return text.replace(".", "").replace(",", ".")
        return text.replace(",", "")

    if "," in text:
        head, tail = text.rsplit(",", 1)
        if tail.isdigit() and len(tail) in (1, 2):
            return f"{head.replace(',', '')}.{tail}"
        return text.replace(",", "")

    if "." in text:
        head, tail = text.rsplit(".", 1)
        if tail.isdigit() and len(tail) in (1, 2):
            return f"{head}.{tail}"
        return text.replace(".", "")

    return text


def _column_name(frame: pd.DataFrame, options: List[str]) -> Optional[str]:
    normalized = {column.strip().lower(): column for column in frame.columns}
    for option in options:
        found = normalized.get(option.lower())
        if found is not None:
            return found
    return None

