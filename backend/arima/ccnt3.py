# backend/arima/ccnt3.py
# Gera séries (histórico + previsão) via ARIMA ou THETA a partir de CSV do TABNET.
# Suporta 2 formatos de entrada:
#   (A) TABNET "wide": coluna "Unidade da Federação" + colunas de período (AAAA ou AAAA/Mes)
#   (B) CSV "longo/tidy": colunas como sistema; uf_sigla; uf_codigo; uf_nome; granularidade; periodo; valor
#
# Modos (frequência de saída):
#   - anual  (padrão): saída anual. Se a origem for mensal, agrega por ano.
#   - mensal: saída mensal (exige origem mensal).
#   - auto  : decide pelo arquivo (mensal → mensal; anual → anual)
#
# Modelos:
#   - arima (padrão)
#   - theta (ThetaForecaster do sktime)
#
# Exemplos:
#   python ccnt3.py --csv dados_limpos_mensal.csv --estado "21" --modo mensal --modelo theta --periodos-prev 12 --alpha 0.95 --saida out.json --pretty

from __future__ import annotations

import argparse
import json
import re
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from pmdarima import auto_arima

# --------------------------- parsing helpers ---------------------------

_MESES_PT_EN = {
    "Jan": "Jan", "Fev": "Feb", "Mar": "Mar", "Abr": "Apr", "Mai": "May", "Jun": "Jun",
    "Jul": "Jul", "Ago": "Aug", "Set": "Sep", "Out": "Oct", "Nov": "Nov", "Dez": "Dec",
    "JAN": "Jan", "FEV": "Feb", "MAR": "Mar", "ABR": "Apr", "MAI": "May", "JUN": "Jun",
    "JUL": "Jul", "AGO": "Aug", "SET": "Sep", "OUT": "Oct", "NOV": "Nov", "DEZ": "Dec",
}


def _read_lines(path: str) -> Tuple[List[str], str]:
    """Lê arquivo tentando encodings comuns (TABNET costuma ser latin-1; limpos costumam ser UTF-8)."""
    for enc in ("utf-8-sig", "utf-8", "ISO-8859-1", "cp1252"):
        try:
            with open(path, "r", encoding=enc) as f:
                return f.read().splitlines(), enc
        except UnicodeDecodeError:
            continue
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        return f.read().splitlines(), "utf-8(replace)"


def _tabnet_header_idx(lines: List[str], max_scan: int = 80) -> Optional[int]:
    """Procura a linha de cabeçalho TABNET (contém 'Unidade da Federação' e colunas de tempo)."""
    for i, ln in enumerate(lines[:max_scan]):
        if "Unidade da Federação" in ln and re.search(r"\b\d{4}\b", ln):
            return i
    return None


def _detectar_freq_por_header(header_cells: List[str]) -> str:
    h = [c.strip().strip('"') for c in header_cells[1:]]
    if h and all(re.fullmatch(r"\d{4}", c) for c in h):
        return "anual"
    if h and all(re.fullmatch(r"\d{4}/[A-Za-z]{3}", c) for c in h):
        return "mensal"
    raise ValueError("Cabeçalho desconhecido: esperava AAAA ou AAAA/MesAbv.")


def _normalizar_meses(colunas: List[str]) -> List[str]:
    out: List[str] = []
    for c in colunas:
        c2 = c.replace('"', "").strip()
        m = re.fullmatch(r"(\d{4})/([A-Za-zçÇ]{3,})", c2)
        if m:
            ano, mes = m.groups()
            mes_abv = _MESES_PT_EN.get(mes[:3].capitalize(), mes[:3].capitalize())
            out.append(f"{ano}/{mes_abv}")
        else:
            out.append(c2)
    return out


def _parse_periodo_mensal(values: pd.Series) -> pd.DatetimeIndex:
    """Aceita 'YYYY/Jan' (PT ou EN), 'YYYY-MM' ou 'YYYY/MM' (numérico)."""
    s = values.astype(str).str.replace('"', "", regex=False).str.strip()

    # numérico YYYY-MM ou YYYY/MM
    if s.str.fullmatch(r"\d{4}[-/]\d{2}").all():
        s = s.str.replace("/", "-", regex=False)
        dt = pd.to_datetime(s + "-01", format="%Y-%m-%d", errors="raise")
        return pd.DatetimeIndex(dt).to_period("M").to_timestamp(how="start")

    # abreviado YYYY/Mon (PT/EN) → normaliza mês PT→EN
    s2 = s.str.replace(
        r"^(\d{4})/([A-Za-zçÇ]{3,})$",
        lambda m: f"{m.group(1)}/{_MESES_PT_EN.get(m.group(2)[:3].capitalize(), m.group(2)[:3].capitalize())}",
        regex=True,
    )
    dt = pd.to_datetime(s2, format="%Y/%b", errors="raise")
    return pd.DatetimeIndex(dt).to_period("M").to_timestamp(how="start")


def _detect_format_and_freq(csv_path: str) -> Tuple[str, str, str, Optional[int]]:
    """Retorna: (formato, freq, encoding, header_idx_tabnet)."""
    lines, enc = _read_lines(csv_path)
    hidx = _tabnet_header_idx(lines)
    if hidx is not None:
        header_cells = _normalizar_meses(lines[hidx].split(";"))
        freq = _detectar_freq_por_header(header_cells)
        return "tabnet", freq, enc, hidx

    header = [c.strip().strip('"').lower() for c in (lines[0].split(";") if lines else [])]
    if "periodo" in header and "valor" in header:
        return "tidy", "auto", enc, None

    raise ValueError(
        "Formato de CSV não reconhecido (esperava TABNET wide ou CSV tidy com 'periodo' e 'valor')."
    )


# --------------------------- loaders ---------------------------

def _carregar_df_tabnet(csv_path: str, enc: str, header_idx: int) -> pd.DataFrame:
    df = pd.read_csv(
        csv_path,
        encoding=enc,
        sep=";",
        header=None,
        skiprows=header_idx + 1,
        dtype=str,
    )
    with open(csv_path, "r", encoding=enc, errors="replace") as f:
        lines = f.read().splitlines()
    header_cells = _normalizar_meses(lines[header_idx].split(";"))
    df.columns = header_cells
    df = df[df["Unidade da Federação"].astype(str).str.match(r"^\d{2} ")]
    return df


def _pick_estado_tabnet(df: pd.DataFrame, estado_input: str) -> Tuple[str, pd.Series]:
    q = estado_input.strip().lower()

    mask = df["Unidade da Federação"].str.lower() == q
    if mask.any():
        rot = df.loc[mask, "Unidade da Federação"].iloc[0]
        return rot, df[df["Unidade da Federação"] == rot].iloc[0]

    m = re.match(r"^(\d{2})\b", q)
    if m:
        code = m.group(1)
        mask = df["Unidade da Federação"].str.startswith(f"{code} ")
        if mask.any():
            rot = df.loc[mask, "Unidade da Federação"].iloc[0]
            return rot, df[df["Unidade da Federação"] == rot].iloc[0]

    mask = df["Unidade da Federação"].str.lower().str.contains(q)
    if mask.any():
        rot = df.loc[mask, "Unidade da Federação"].iloc[0]
        return rot, df[df["Unidade da Federação"] == rot].iloc[0]

    raise ValueError(f"UF '{estado_input}' não encontrada.")


def _serie_from_tabnet_row(row: pd.Series, freq: str) -> pd.Series:
    s = row.drop("Unidade da Federação").astype(str).str.replace('"', "", regex=False).str.strip()
    s = s.str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    vals = pd.to_numeric(s, errors="coerce").fillna(0.0).astype(float)

    if freq == "anual":
        idx = pd.Index([int(re.search(r"(\d{4})", c).group(1)) for c in vals.index], name="Ano")
        out = pd.Series(vals.values, index=idx, name="valor").sort_index()
        full = pd.RangeIndex(out.index.min(), out.index.max() + 1, name="Ano")
        return out.reindex(full).fillna(0.0)

    dt = pd.to_datetime(pd.Index(vals.index), format="%Y/%b")
    out = pd.Series(
        vals.values,
        index=pd.DatetimeIndex(dt).to_period("M").to_timestamp(how="start"),
        name="valor",
    ).sort_index()
    full = pd.date_range(out.index.min(), out.index.max(), freq="MS")
    return out.reindex(full).fillna(0.0)


def _carregar_df_tidy(csv_path: str, enc: str) -> pd.DataFrame:
    df = pd.read_csv(csv_path, encoding=enc, sep=";", dtype=str)
    df.columns = [c.strip().strip('"') for c in df.columns]
    return df


def _pick_estado_tidy(df: pd.DataFrame, estado_input: str) -> Tuple[str, pd.DataFrame]:
    q = estado_input.strip()

    m = re.match(r"^(\d{2})\b", q)
    if m and "uf_codigo" in df.columns:
        code = m.group(1)
        dff = df[df["uf_codigo"].astype(str) == code]
        if not dff.empty:
            nome = dff["uf_nome"].iloc[0] if "uf_nome" in dff.columns else code
            return f"{code} {nome}".strip(), dff

    if len(q) == 2 and "uf_sigla" in df.columns:
        dff = df[df["uf_sigla"].astype(str).str.upper() == q.upper()]
        if not dff.empty:
            code = dff["uf_codigo"].iloc[0] if "uf_codigo" in dff.columns else q.upper()
            nome = dff["uf_nome"].iloc[0] if "uf_nome" in dff.columns else q.upper()
            return f"{code} {nome}".strip(), dff

    if "uf_nome" in df.columns:
        dff = df[df["uf_nome"].astype(str).str.lower().str.contains(q.lower())]
        if not dff.empty:
            code = dff["uf_codigo"].iloc[0] if "uf_codigo" in dff.columns else ""
            nome = dff["uf_nome"].iloc[0]
            return f"{code} {nome}".strip(), dff

    raise ValueError(f"UF '{estado_input}' não encontrada no CSV tidy.")


def _detectar_freq_tidy(df: pd.DataFrame) -> str:
    if "granularidade" in df.columns:
        g = df["granularidade"].dropna().astype(str).str.lower().unique()
        if len(g) == 1 and g[0] in ("anual", "mensal"):
            return g[0]

    if "periodo" not in df.columns:
        raise ValueError("CSV tidy não tem coluna 'periodo'.")

    p = df["periodo"].dropna().astype(str).str.strip()
    if p.str.fullmatch(r"\d{4}").all():
        return "anual"
    if p.str.fullmatch(r"\d{4}/[A-Za-zçÇ]{3,}").all() or p.str.fullmatch(r"\d{4}[-/]\d{2}").all():
        return "mensal"
    raise ValueError("Não consegui detectar granularidade pelo 'periodo' do CSV tidy.")


def _serie_from_tidy(df_estado: pd.DataFrame, freq: str) -> pd.Series:
    if "valor" not in df_estado.columns or "periodo" not in df_estado.columns:
        raise ValueError("CSV tidy precisa ter colunas 'periodo' e 'valor'.")

    v = df_estado["valor"].astype(str).str.replace('"', "", regex=False).str.strip()
    v = v.str.replace(".", "", regex=False).str.replace(",", ".", regex=False)
    vals = pd.to_numeric(v, errors="coerce").fillna(0.0)

    if freq == "anual":
        anos = pd.to_numeric(
            df_estado["periodo"].astype(str).str.extract(r"(\d{4})")[0],
            errors="coerce",
        )
        s = pd.Series(vals.values, index=anos.astype(int), name="valor")
        s = s.groupby(level=0).sum().sort_index()
        full = pd.RangeIndex(s.index.min(), s.index.max() + 1, name="Ano")
        return s.reindex(full).fillna(0.0)

    idx = _parse_periodo_mensal(df_estado["periodo"])
    s = pd.Series(vals.values, index=idx, name="valor")
    s = s.groupby(level=0).sum().sort_index()
    full = pd.date_range(s.index.min(), s.index.max(), freq="MS")
    return s.reindex(full).fillna(0.0)


def _series_anuais(s: pd.Series) -> pd.Series:
    if isinstance(s.index, pd.DatetimeIndex):
        return s.groupby(s.index.year).sum()
    return s.copy()


# --------------------------- ARIMA ---------------------------

def _fit_arima_log1p(y: np.ndarray, seasonal: bool, m: int) -> Any:
    return auto_arima(
        y,
        seasonal=seasonal,
        m=m if seasonal else 1,
        D=0,
        trend="t",
        start_p=1,
        start_q=1,
        max_p=8,
        max_q=8,
        stepwise=True,
        suppress_warnings=True,
        trace=False,
    )


def _arima_forecast_log(
    y_log: np.ndarray,
    n_periods: int,
    alpha: float,
    seasonal: bool,
    m: int,
) -> Tuple[np.ndarray, np.ndarray]:
    modelo = _fit_arima_log1p(y_log, seasonal=seasonal, m=m)
    fc_log, ci_log = modelo.predict(
        n_periods=int(n_periods),
        return_conf_int=True,
        alpha=1 - alpha,
    )
    return np.asarray(fc_log), np.asarray(ci_log)


# --------------------------- THETA (sktime) ---------------------------

_Z_TABLE = {
    0.80: 1.2816,
    0.85: 1.4395,
    0.90: 1.6449,
    0.95: 1.96,
    0.97: 2.1701,
    0.98: 2.3263,
    0.99: 2.5758,
}


def _z_for_alpha(alpha: float) -> float:
    keys = sorted(_Z_TABLE.keys())
    best = min(keys, key=lambda k: abs(k - alpha))
    return _Z_TABLE[best]


def _theta_forecast_log(
    ts_log: pd.Series,
    n_periods: int,
    alpha: float,
    sp: int,
) -> Tuple[np.ndarray, np.ndarray]:
    """Retorna (forecast_log, conf_int_log[n,2]) em escala log."""
    try:
        from sktime.forecasting.base import ForecastingHorizon
        from sktime.forecasting.theta import ThetaForecaster
    except Exception as e:
        raise RuntimeError("Para usar THETA, instale: pip install sktime") from e

    fh = ForecastingHorizon(np.arange(1, int(n_periods) + 1), is_relative=True)
    forecaster = ThetaForecaster(sp=int(sp))
    forecaster.fit(ts_log)

    y_pred_log = forecaster.predict(fh)

    # Intervalo nativo (quando disponível)
    try:
        pred_int = forecaster.predict_interval(fh, coverage=[alpha])
        cols = list(pred_int.columns)

        lower_col = None
        upper_col = None
        for c in cols:
            if isinstance(c, tuple):
                if "lower" in c and lower_col is None:
                    lower_col = c
                if "upper" in c and upper_col is None:
                    upper_col = c
            else:
                cs = str(c).lower()
                if "lower" in cs and lower_col is None:
                    lower_col = c
                if "upper" in cs and upper_col is None:
                    upper_col = c

        if lower_col is None or upper_col is None:
            raise RuntimeError(f"Não identifiquei lower/upper em pred_int.columns={pred_int.columns}")

        fc_log = np.asarray(y_pred_log)
        lower = np.asarray(pred_int[lower_col])
        upper = np.asarray(pred_int[upper_col])
        ci_log = np.column_stack([lower, upper])
        return fc_log, ci_log

    except Exception:
        # Fallback simples com sigma dos resíduos em log
        try:
            y_in = forecaster.predict_in_sample()
            y_in = y_in.reindex(ts_log.index)
            resid = (ts_log - y_in).to_numpy()
            sigma = float(np.nanstd(resid)) if np.isfinite(resid).any() else float(np.nanstd(np.diff(ts_log.to_numpy())))
        except Exception:
            sigma = float(np.nanstd(np.diff(ts_log.to_numpy()))) if len(ts_log) > 2 else 0.0

        z = _z_for_alpha(alpha)
        fc_log = np.asarray(y_pred_log)
        lower = fc_log - z * sigma
        upper = fc_log + z * sigma
        ci_log = np.column_stack([lower, upper])
        return fc_log, ci_log


# --------------------------- Forecast API ---------------------------

def gerar_series_anuais(
    caminho_csv: str,
    estado: str,
    anos_previsao: int = 3,
    alpha: float = 0.95,
    modelo: str = "arima",
) -> Dict[str, Any]:
    """Saída anual. Se origem mensal, agrega por ano. Modelo: arima|theta."""
    modelo = (modelo or "arima").strip().lower()
    if modelo not in ("arima", "theta"):
        raise ValueError("modelo inválido. Use: arima | theta")

    fmt, freq, enc, hidx = _detect_format_and_freq(caminho_csv)

    if fmt == "tabnet":
        assert hidx is not None
        df = _carregar_df_tabnet(caminho_csv, enc, hidx)
        estado_rotulo, row = _pick_estado_tabnet(df, estado)
        serie = _serie_from_tabnet_row(row, freq=freq)
        serie_ano = _series_anuais(serie) if freq == "mensal" else serie
        freq_origem = freq
    else:
        df = _carregar_df_tidy(caminho_csv, enc)
        freq_origem = _detectar_freq_tidy(df)
        estado_rotulo, dff = _pick_estado_tidy(df, estado)
        serie = _serie_from_tidy(dff, freq=freq_origem)
        serie_ano = _series_anuais(serie) if freq_origem == "mensal" else serie

    ts_log = np.log1p(serie_ano.values)

    if modelo == "arima":
        fc_log, ci_log = _arima_forecast_log(ts_log, anos_previsao, alpha, seasonal=False, m=1)
        modelo_nome = "ARIMA"
    else:
        ts_log_s = pd.Series(ts_log, index=serie_ano.index)
        fc_log, ci_log = _theta_forecast_log(ts_log_s, anos_previsao, alpha, sp=1)
        modelo_nome = "ThetaForecaster (sktime)"

    fc = np.clip(np.expm1(np.asarray(fc_log)), 0, None)
    ci = np.clip(np.expm1(np.asarray(ci_log)), 0, None)

    last_year = int(pd.Index(serie_ano.index).max())
    anos_futuros = [last_year + i for i in range(1, int(anos_previsao) + 1)]

    dados_orig = [{"ano": int(a), "valor": float(v)} for a, v in zip(serie_ano.index, serie_ano.values)]
    prev = [
        {"ano": int(anos_futuros[i]), "valor": float(fc[i]), "li": float(ci[i, 0]), "ls": float(ci[i, 1])}
        for i in range(int(anos_previsao))
    ]

    return {
        "frequencia_origem": freq_origem,
        "frequencia_saida": "anual",
        "estado_rotulo": estado_rotulo,
        "dados_originais": dados_orig,
        "previsao": prev,
        "modelo": modelo_nome,
    }


def gerar_series_mensais(
    caminho_csv: str,
    estado: str,
    periodos_previsao: int = 12,
    alpha: float = 0.95,
    seasonal: bool = True,
    modelo: str = "arima",
) -> Dict[str, Any]:
    """Saída mensal (origem precisa ser mensal). Modelo: arima|theta."""
    modelo = (modelo or "arima").strip().lower()
    if modelo not in ("arima", "theta"):
        raise ValueError("modelo inválido. Use: arima | theta")

    fmt, freq, enc, hidx = _detect_format_and_freq(caminho_csv)

    if fmt == "tabnet":
        assert hidx is not None
        if freq != "mensal":
            raise ValueError("Para previsão mensal (TABNET wide), o cabeçalho deve estar em AAAA/Mes.")
        df = _carregar_df_tabnet(caminho_csv, enc, hidx)
        estado_rotulo, row = _pick_estado_tabnet(df, estado)
        serie_m = _serie_from_tabnet_row(row, freq="mensal")
    else:
        df = _carregar_df_tidy(caminho_csv, enc)
        freq_origem = _detectar_freq_tidy(df)
        if freq_origem != "mensal":
            raise ValueError("Para previsão mensal (CSV tidy), a coluna 'granularidade'/'periodo' deve ser mensal.")
        estado_rotulo, dff = _pick_estado_tidy(df, estado)
        serie_m = _serie_from_tidy(dff, freq="mensal")

    use_seasonal = bool(seasonal) and len(serie_m) >= 24
    m = 12 if use_seasonal else 1

    ts_log = np.log1p(serie_m.values)

    if modelo == "arima":
        fc_log, ci_log = _arima_forecast_log(ts_log, periodos_previsao, alpha, seasonal=use_seasonal, m=m)
        modelo_nome = "ARIMA"
    else:
        # sktime ThetaForecaster chokes on MonthBegin as Period freq; use PeriodIndex explicitly.
        ts_log_s = pd.Series(ts_log, index=pd.PeriodIndex(serie_m.index, freq="M"))
        fc_log, ci_log = _theta_forecast_log(ts_log_s, periodos_previsao, alpha, sp=m)
        modelo_nome = "ThetaForecaster (sktime)"

    fc = np.clip(np.expm1(np.asarray(fc_log)), 0, None)
    ci = np.clip(np.expm1(np.asarray(ci_log)), 0, None)

    last = pd.Timestamp(serie_m.index.max())
    futuros = pd.date_range(last + pd.offsets.MonthBegin(1), periods=int(periodos_previsao), freq="MS")

    dados_orig = [{"mes": d.strftime("%Y-%m"), "valor": float(v)} for d, v in zip(serie_m.index, serie_m.values)]
    prev = [
        {"mes": futuros[i].strftime("%Y-%m"), "valor": float(fc[i]), "li": float(ci[i, 0]), "ls": float(ci[i, 1])}
        for i in range(int(periodos_previsao))
    ]

    return {
        "frequencia_origem": "mensal",
        "frequencia_saida": "mensal",
        "estado_rotulo": estado_rotulo,
        "dados_originais": dados_orig,
        "previsao": prev,
        "modelo": modelo_nome,
        "seasonal": bool(use_seasonal),
        "m": int(m),
    }


# --------------------------- CLI ---------------------------

def _main() -> None:
    p = argparse.ArgumentParser(description="Gera JSON (histórico + previsão) via ARIMA ou THETA")
    p.add_argument("--csv", required=True)
    p.add_argument("--estado", required=True, help="ex.: '21 Maranhão' | 'Maranhão' | '21' | 'MA'")
    p.add_argument("--alpha", type=float, default=0.95)

    p.add_argument("--modo", choices=["anual", "mensal", "auto"], default="anual")
    p.add_argument("--modelo", choices=["arima", "theta"], default="arima")

    p.add_argument("--anos-prev", type=int, default=None, help="horizonte ANUAL em anos")
    p.add_argument("--periodos-prev", type=int, default=None, help="horizonte em períodos (meses no modo mensal)")

    p.add_argument("--seasonal", action="store_true", help="força sazonalidade no mensal (m=12)")
    p.add_argument("--no-seasonal", action="store_true", help="desliga sazonalidade no mensal")

    p.add_argument("--saida", default="-")
    p.add_argument("--pretty", action="store_true")
    args = p.parse_args()

    n_prev = args.periodos_prev if args.periodos_prev is not None else args.anos_prev
    if n_prev is None:
        n_prev = 3 if args.modo != "mensal" else 12

    if args.modo == "auto":
        fmt, freq, enc, _ = _detect_format_and_freq(args.csv)
        if fmt == "tidy":
            df = pd.read_csv(args.csv, encoding=enc, sep=";", dtype=str)
            freq = _detectar_freq_tidy(df)
        modo = "mensal" if freq == "mensal" else "anual"
    else:
        modo = args.modo

    if args.no_seasonal:
        seasonal = False
    elif args.seasonal:
        seasonal = True
    else:
        seasonal = True

    if modo == "mensal":
        payload = gerar_series_mensais(
            args.csv,
            args.estado,
            periodos_previsao=int(n_prev),
            alpha=args.alpha,
            seasonal=seasonal,
            modelo=args.modelo,
        )
    else:
        payload = gerar_series_anuais(
            args.csv,
            args.estado,
            anos_previsao=int(n_prev),
            alpha=args.alpha,
            modelo=args.modelo,
        )

    if args.saida == "-":
        print(json.dumps(payload, ensure_ascii=False, indent=2 if args.pretty else None))
    else:
        with open(args.saida, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2 if args.pretty else None)


if __name__ == "__main__":
    _main()
