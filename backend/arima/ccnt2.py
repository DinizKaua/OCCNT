# backend/arima/ccnt2.py
# Módulo + CLI: gera séries anuais (histórico + previsão) a partir de CSV TABNET
# Uso CLI (exemplo):
#   python ccnt2.py --csv dados.csv --estado "21 Maranhão" --anos-prev 3 --alpha 0.95 --saida out.json --pretty

from __future__ import annotations
import argparse, json, re, sys, os
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from pmdarima import auto_arima


def _detectar_freq_por_header(header_cells: List[str]) -> str:
    h = [c.strip().strip('"') for c in header_cells[1:]]
    if all(re.match(r"^\d{4}$", c) for c in h):
        return "anual"
    if all(re.match(r"^\d{4}/[A-Za-z]{3}$", c) for c in h):
        return "mensal"
    raise ValueError("Cabeçalho desconhecido: esperava AAAA ou AAAA/MesAbv.")


def _normalizar_meses(colunas: List[str]) -> List[str]:
    meses_pt_en = {
        "Jan": "Jan",
        "Fev": "Feb",
        "Mar": "Mar",
        "Abr": "Apr",
        "Mai": "May",
        "Jun": "Jun",
        "Jul": "Jul",
        "Ago": "Aug",
        "Set": "Sep",
        "Out": "Oct",
        "Nov": "Nov",
        "Dez": "Dec",
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
    }
    out = []
    for c in colunas:
        c2 = c.replace('"', "").strip()
        m = re.match(r"(\d{4})/([A-Za-zçÇ]{3,})", c2)
        if m:
            ano, mes = m.groups()
            mes_abv = meses_pt_en.get(mes[:3].capitalize(), mes[:3].capitalize())
            out.append(f"{ano}/{mes_abv}")
        else:
            out.append(c2)
    return out


def _ler_header_bruto(caminho_csv: str) -> Tuple[List[str], int, str]:
    with open(caminho_csv, "r", encoding="ISO-8859-1") as f:
        linhas = f.read().splitlines()
    # alguns TABNETs têm o header na linha 9, outros na 8
    header_idx = 9 if len(linhas) > 9 and "Unidade da Federação" in linhas[9] else 8
    header_cells = linhas[header_idx].split(";")
    freq = _detectar_freq_por_header(header_cells)
    colunas = _normalizar_meses(header_cells)
    return colunas, header_idx, freq


def _carregar_df_tabnet(caminho_csv: str, colunas: List[str], header_idx: int) -> pd.DataFrame:
    df = pd.read_csv(
        caminho_csv,
        encoding="ISO-8859-1",
        sep=";",
        header=None,
        skiprows=header_idx + 1,
    )
    df.columns = colunas
    # filtra só linhas de UF (começam com "dd ")
    df = df[df["Unidade da Federação"].astype(str).str.match(r"^\d{2} ")]
    return df


def _pick_estado(df: pd.DataFrame, estado_input: str) -> Tuple[str, pd.Series]:
    q = estado_input.strip().lower()

    # 1) match exato
    mask = df["Unidade da Federação"].str.lower() == q
    if mask.any():
        rot = df.loc[mask, "Unidade da Federação"].iloc[0]
        return rot, df[df["Unidade da Federação"] == rot].iloc[0]

    # 2) código "21"
    if re.match(r"^\d{2}$", q):
        mask = df["Unidade da Federação"].str.startswith(f"{q} ")
        if mask.any():
            rot = df.loc[mask, "Unidade da Federação"].iloc[0]
            return rot, df[df["Unidade da Federação"] == rot].iloc[0]

    # 3) contains "maranhão"
    mask = df["Unidade da Federação"].str.lower().str.contains(q)
    if mask.any():
        rot = df.loc[mask, "Unidade da Federação"].iloc[0]
        return rot, df[df["Unidade da Federação"] == rot].iloc[0]

    raise ValueError(f"UF '{estado_input}' não encontrada nas colunas.")


def _serie_da_linha(linha: pd.Series, freq: str) -> pd.Series:
    # tira a coluna de UF
    s = (
        linha.drop("Unidade da Federação")
        .astype(str)
        .str.replace(",", ".")
        .astype(float)
    )
    # ffill/bfill de forma compatível
    s = (
        s.replace([np.inf, -np.inf], np.nan)
        .ffill()
        .bfill()
    )

    if freq == "anual":
        # índice vira o ano
        import re as _re

        idx = pd.Index(
            [int(_re.search(r"(\d{4})", c).group(1)) for c in s.index],
            name="Ano",
        )
        s.index = idx
    else:
        # datas mensais
        s.index = pd.to_datetime(s.index, format="%Y/%b")
        s.index.name = "Mês"
    return s


def _series_anuais(s: pd.Series, freq: str) -> pd.Series:
    if freq == "anual":
        return s.copy()
    # soma por ano
    return s.groupby(s.index.year).sum()


def gerar_series_anuais(
    caminho_csv: str,
    estado: str,
    anos_previsao: int = 3,
    alpha: float = 0.95,
) -> Dict[str, Any]:
    # 1) ler cabeçalho e freq
    colunas, header_idx, freq = _ler_header_bruto(caminho_csv)
    # 2) carregar df
    df = _carregar_df_tabnet(caminho_csv, colunas, header_idx)
    # 3) pegar linha do estado
    estado_rotulo, linha = _pick_estado(df, estado)
    # 4) transformar linha em série de tempo
    serie = _serie_da_linha(linha, freq)
    # 5) garantir anual
    serie_ano = _series_anuais(serie, freq)

    # 6) ARIMA em log1p
    ts_log = np.log1p(serie_ano)

    modelo = auto_arima(
        ts_log,
        seasonal=False,
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

    forecast_log, conf_int_log = modelo.predict(
        n_periods=anos_previsao,
        return_conf_int=True,
        alpha=1 - alpha,
    )

    # às vezes vêm como Series com índices estranhos → força para np.array
    forecast_log = np.array(forecast_log)
    conf_int_log = np.array(conf_int_log)

    # 7) desfaz log1p
    forecast = np.expm1(forecast_log)
    ci = np.expm1(conf_int_log)

    # 8) valores negativos → 0
    forecast = np.clip(forecast, 0, None)
    ci = np.clip(ci, 0, None)

    # 9) anos futuros
    last_year = int(serie_ano.index.max())
    anos_futuros = [last_year + i for i in range(1, anos_previsao + 1)]

    dados_originais = [
        {"ano": int(a), "valor": float(v)} for a, v in serie_ano.items()
    ]

    # 10) monta previsões usando índices de array
    previsao = []
    for i in range(anos_previsao):
        previsao.append(
            {
                "ano": int(anos_futuros[i]),
                "valor": float(forecast[i]),
                "li": float(ci[i, 0]),
                "ls": float(ci[i, 1]),
            }
        )

    return {
        "frequencia_origem": freq,
        "estado_rotulo": estado_rotulo,
        "dados_originais": dados_originais,
        "previsao": previsao,
        "modelo": "ARIMA",
    }


def _main():
    p = argparse.ArgumentParser(
        description="Gera JSON anual (histórico + previsão) via ARIMA"
    )
    p.add_argument("--csv", required=True)
    p.add_argument(
        "--estado",
        required=True,
        help="ex.: '21 Maranhão' | 'Maranhão' | '21'",
    )
    p.add_argument("--anos-prev", type=int, default=3)
    p.add_argument("--alpha", type=float, default=0.95)
    p.add_argument("--saida", default="-")
    p.add_argument("--pretty", action="store_true")
    args = p.parse_args()

    payload = gerar_series_anuais(
        args.csv, args.estado, args.anos_prev, args.alpha
    )
    if args.saida == "-":
        print(
            json.dumps(
                payload, ensure_ascii=False, indent=2 if args.pretty else None
            )
        )
    else:
        with open(args.saida, "w", encoding="utf-8") as f:
            json.dump(
                payload, f, ensure_ascii=False, indent=2 if args.pretty else None
            )


if __name__ == "__main__":
    _main()
