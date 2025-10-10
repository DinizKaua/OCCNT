import streamlit as st
import pandas as pd
import numpy as np
from pmdarima import auto_arima
import base64
import re

st.set_page_config(layout="wide")

# === Plano de fundo escuro e logo ===
def set_dark_background_with_logo():
    try:
        with open("logo_base64.txt", "r") as f:
            base64_logo = f.read().strip()
        css = f"""
        <style>
        .stApp {{
            background-color: #121212;
            color: white;
        }}
        .logo-container {{
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 1rem;
        }}
        .logo-container img {{
            width: 300px;
        }}
        </style>
        <div class="logo-container">
            <img src="data:image/png;base64,{base64_logo}" alt="Logo">
        </div>
        """
        st.markdown(css, unsafe_allow_html=True)
    except:
        pass

set_dark_background_with_logo()
st.title("📊 Previsão de DCNTs com ARIMA")

abas = st.tabs(["📥 Entrada & Visualização", "📊 Previsão", "ℹ️ Sobre o Projeto"])

# === Funções auxiliares ===
def detectar_frequencia(header):
    if all(re.match(r"^\d{4}$", h.strip('"')) for h in header[1:]):
        return "anual"
    elif all(re.match(r"^\d{4}/[A-Za-z]{3}$", h.strip('"')) for h in header[1:]):
        return "mensal"
    return None

def traduzir_meses_portugues(colunas):
    meses_pt_en = {
        "Jan": "Jan", "Fev": "Feb", "Mar": "Mar", "Abr": "Apr", "Mai": "May", "Jun": "Jun",
        "Jul": "Jul", "Ago": "Aug", "Set": "Sep", "Out": "Oct", "Nov": "Nov", "Dez": "Dec"
    }
    traduzidas = []
    for col in colunas:
        col = col.replace('"', '')
        match = re.match(r"(\d{4})/([A-Za-zçÇ]+)", col)
        if match:
            ano, mes_pt = match.groups()
            mes_abv = meses_pt_en.get(mes_pt[:3].capitalize(), mes_pt[:3])
            traduzidas.append(f"{ano}/{mes_abv}")
        else:
            traduzidas.append(col)
    return traduzidas

# === Aba 1: Entrada & Visualização ===
with abas[0]:
    st.header("📥 Entrada de Dados")
    arquivo = st.file_uploader("Selecione o arquivo CSV", type="csv")
    if arquivo:
        try:
            linhas = arquivo.read().decode("ISO-8859-1").splitlines()
            arquivo.seek(0)

            header_idx = 9 if "Unidade da Federação" in linhas[9] else 8
            header = linhas[header_idx].replace('"', '').split(";")
            colunas_originais = header[1:]
            colunas = traduzir_meses_portugues(header)
            frequencia = detectar_frequencia(colunas)

            if not frequencia:
                st.error("Formato de coluna desconhecido. Esperado: anos (AAAA) ou meses (AAAA/MêsAbv).")
                st.stop()

            df = pd.read_csv(
                arquivo,
                encoding="ISO-8859-1",
                sep=";",
                header=None,
                skiprows=header_idx + 1
            )
            df.columns = colunas
            df = df[df["Unidade da Federação"].str.match(r"^\d{2} ")]

            estados_disponiveis = sorted(df["Unidade da Federação"].unique())
            estado = st.selectbox("Selecione o Estado:", estados_disponiveis)

            linha = df[df["Unidade da Federação"] == estado].iloc[0]
            serie = linha.drop("Unidade da Federação").astype(str).str.replace(",", ".").astype(float)

            if frequencia == "anual":
                serie.index = serie.index.astype(str).str.extract(r"(\d{4})")[0].astype(int)
            else:
                serie.index = pd.to_datetime(serie.index, format="%Y/%b")

            st.subheader(f"📈 Série Histórica – {estado}")
            st.line_chart(serie, use_container_width=True)

        except Exception as e:
            st.error(f"Erro ao processar o arquivo: {e}")
    else:
        st.info("Faça o upload de um arquivo CSV para começar.")

# === Aba 2: Previsão ===
with abas[1]:
    st.header("📊 Previsão com ARIMA")
    if 'serie' in locals():
        frequencia = "mensal" if isinstance(serie.index[0], pd.Timestamp) else "anual"
        step = 1 if frequencia == "anual" else 12
        unidade = "anos" if frequencia == "anual" else "meses"

        n_periods = st.slider(f"Prever quantos {unidade} à frente?", step, step * 5, step * 3, step=step)
        btn = st.button("🚀 Executar Previsão")
        if btn:
            with st.spinner("Treinando modelo..."):
                try:
                    ts_log = np.log1p(serie)
                    modelo = auto_arima(ts_log, seasonal=(frequencia == "mensal"), stepwise=True, suppress_warnings=True)
                    forecast_log = modelo.predict(n_periods=n_periods)
                    forecast = np.expm1(forecast_log)
                    forecast = np.nan_to_num(forecast, nan=0.0, posinf=0.0, neginf=0.0)
                    forecast[forecast < 0] = 0

                    if frequencia == "anual":
                        index_futuro = pd.Index(range(serie.index.max() + 1, serie.index.max() + 1 + n_periods))
                    else:
                        index_futuro = pd.date_range(start=serie.index.max() + pd.DateOffset(months=1), periods=n_periods, freq="MS")

                    previsao = pd.Series(forecast, index=index_futuro, name="Previsão")
                    df_plot = pd.DataFrame({"Histórico": serie, "Previsão": pd.concat([serie.tail(1), previsao])})

                    st.subheader("📈 Gráfico de Previsão")
                    st.line_chart(df_plot, use_container_width=True)

                    with st.expander("🔢 Tabela de Previsão"):
                        st.dataframe(previsao.reset_index().rename(columns={"index": "Período"}))

                    with st.expander("⚙️ Parâmetros do Modelo"):
                        st.metric("Ordem ARIMA (p,d,q)", f"{modelo.order}")

                except Exception as e:
                    st.error(f"Erro durante a previsão: {e}")
    else:
        st.info("Envie um arquivo na aba anterior para habilitar a previsão.")

# === Aba 3: Sobre o Projeto ===
with abas[2]:
    st.header("ℹ️ Sobre o Projeto")
    st.markdown("""
    Este projeto visa analisar séries históricas de indicadores de saúde (como óbitos e equipamentos hospitalares),
    permitindo a previsão de tendências por meio do modelo ARIMA. É compatível com dados anuais e mensais, com seleção por estado.
    """)

