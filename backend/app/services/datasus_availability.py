from __future__ import annotations

from collections import defaultdict
from ftplib import FTP
from functools import lru_cache
import re
from typing import Dict, Iterable


FTP_HOST = "ftp.datasus.gov.br"
FTP_TIMEOUT = 30

SIM_DO_GENERAL_DIR = "/dissemin/publicos/SIM/CID10/DORES/"
SIM_DO_PRELIM_DIR = "/dissemin/publicos/SIM/PRELIM/DORES/"
SIH_CURRENT_DIR = "/dissemin/publicos/SIHSUS/200801_/Dados/"
SIH_LEGACY_DIR = "/dissemin/publicos/SIHSUS/199201_200712/Dados/"


@lru_cache(maxsize=16)
def _list_ftp_directory(directory: str) -> tuple[str, ...]:
    ftp = FTP(FTP_HOST, timeout=FTP_TIMEOUT)
    try:
        ftp.login()
        ftp.cwd(directory)
        return tuple(ftp.nlst())
    finally:
        try:
            ftp.quit()
        except Exception:
            pass


def get_datasus_availability(system: str, uf: str, granularity: str = "year") -> dict:
    normalized_system = (system or "SIM-DO").strip().upper()
    normalized_uf = (uf or "MA").strip().upper()
    normalized_granularity = (granularity or "year").strip().lower()

    if normalized_system in {"SIM-DO", "SIM-DO-PRELIM"}:
        month_map = _sim_month_map(normalized_system, normalized_uf)
    elif normalized_system == "SIH-RD":
        month_map = _sih_month_map(normalized_uf)
    else:
        raise ValueError(f"Sistema nao suportado para disponibilidade: {normalized_system}")

    if not month_map:
        raise ValueError(f"Nao foi possivel localizar periodos disponiveis para {normalized_system} em {normalized_uf}.")

    year_options = sorted(month_map)
    default_year = year_options[-1]
    default_months = month_map.get(default_year, list(range(1, 13)))
    default_month = default_months[-1] if default_months else 12

    return {
        "system": normalized_system,
        "uf": normalized_uf,
        "granularity": normalized_granularity,
        "year_options": year_options,
        "month_map": {str(year): months for year, months in month_map.items()},
        "month_options": month_map.get(default_year, list(range(1, 13))),
        "latest_year": default_year,
        "latest_month": default_month,
    }


def validate_export_periods(
    *,
    system: str,
    uf: str,
    granularity: str,
    year_start: int,
    year_end: int,
    month_start: int,
    month_end: int,
) -> dict:
    availability = get_datasus_availability(system=system, uf=uf, granularity=granularity)
    available_years = set(availability["year_options"])
    requested_years = list(range(int(year_start), int(year_end) + 1))
    missing_years = [year for year in requested_years if year not in available_years]
    if missing_years:
        raise ValueError(f"Os anos {', '.join(str(item) for item in missing_years)} nao estao disponiveis no DATASUS para esse sistema/UF.")

    if granularity == "month":
        month_map = {int(year): months for year, months in availability["month_map"].items()}
        requested_periods = _iter_requested_months(
            year_start=int(year_start),
            year_end=int(year_end),
            month_start=int(month_start),
            month_end=int(month_end),
        )
        missing_periods = [
            f"{year}-{month:02d}"
            for year, month in requested_periods
            if month not in set(month_map.get(year, []))
        ]
        if missing_periods:
            raise ValueError(f"Os meses {', '.join(missing_periods)} nao estao disponiveis no DATASUS para esse sistema/UF.")

    return availability


def _sim_month_map(system: str, uf: str) -> dict[int, list[int]]:
    prefixes = [f"DO{uf}"]
    general_years = _extract_sim_years(_list_ftp_directory(SIM_DO_GENERAL_DIR), prefixes)
    prelim_years = _extract_sim_years(_list_ftp_directory(SIM_DO_PRELIM_DIR), prefixes)

    if system == "SIM-DO-PRELIM":
        years = prelim_years
    else:
        years = sorted(set(general_years) | set(prelim_years))

    return {year: list(range(1, 13)) for year in years}


def _sih_month_map(uf: str) -> dict[int, list[int]]:
    prefix = f"RD{uf}"
    items = list(_list_ftp_directory(SIH_LEGACY_DIR)) + list(_list_ftp_directory(SIH_CURRENT_DIR))
    year_map: dict[int, set[int]] = defaultdict(set)
    for item in items:
        match = re.fullmatch(fr"{prefix}(\d{{2}})(\d{{2}})\.dbc", item, re.IGNORECASE)
        if not match:
            continue
        year_suffix, month_text = match.groups()
        year_value = int(year_suffix)
        full_year = 1900 + year_value if year_value >= 90 else 2000 + year_value
        month_value = int(month_text)
        year_map[full_year].add(month_value)

    return {year: sorted(months) for year, months in sorted(year_map.items())}


def _extract_sim_years(items: Iterable[str], prefixes: list[str]) -> list[int]:
    years: set[int] = set()
    for item in items:
        for prefix in prefixes:
            match = re.fullmatch(fr"{prefix}(\d{{4}})\.dbc", item, re.IGNORECASE)
            if match:
                years.add(int(match.group(1)))
                break
    return sorted(years)


def _iter_requested_months(*, year_start: int, year_end: int, month_start: int, month_end: int) -> list[tuple[int, int]]:
    periods: list[tuple[int, int]] = []
    for year in range(year_start, year_end + 1):
        start = month_start if year == year_start else 1
        end = month_end if year == year_end else 12
        for month in range(start, end + 1):
            periods.append((year, month))
    return periods
