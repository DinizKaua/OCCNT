import streamlit as st
import pandas as pd
import numpy as np
from pmdarima import auto_arima
import base64
import re

from statsmodels.tsa.seasonal import seasonal_decompose
import matplotlib.pyplot as plt
from sklearn.metrics import mean_squared_error

st.set_page_config(layout="wide")
st.title("Previsão com ARIMA")
abas = st.tabs(["Entrada & Visualização", "Previsão & Avaliação"])

# === Funções auxiliares ===
def detectar_frequencia(header):
    if all(re.match(r"^\d{4}$", h.strip('"')) for h in header[1:]):
        return "anual"
    elif all(re.match(r"^\d{4}/[A-Za-z]{3}$", h.strip('"')) for h in header[1:]):
        return "mensal"
    return None

def traduzir_meses_portugues(colunas_originais):
    meses_pt_en = {
        "Jan": "Jan", "Fev": "Feb", "Mar": "Mar", "Abr": "Apr", "Mai": "May", "Jun": "Jun",
        "Jul": "Jul", "Ago": "Aug", "Set": "Sep", "Out": "Oct", "Nov": "Nov", "Dez": "Dec",
        "JAN": "Jan", "FEV": "Feb", "MAR": "Mar", "ABR": "Apr", "MAI": "May", "JUN": "Jun",
        "JUL": "Jul", "AGO": "Aug", "SET": "Sep", "OUT": "Oct", "NOV": "Nov", "DEZ": "Dec"
    }
    traduzidas = []
    for col in colunas_originais:
        col_limpa = col.replace('"', '').strip() 
        match = re.match(r"(\d{4})/([A-Za-zçÇ]+)", col_limpa)
        if match:
            ano, mes_pt = match.groups()
            mes_abv_key = mes_pt[:3].capitalize()
            mes_abv = meses_pt_en.get(mes_abv_key, mes_abv_key)
            traduzidas.append(f"{ano}/{mes_abv}")
        else:
            traduzidas.append(col_limpa)
    return traduzidas

@st.cache_data(show_spinner="Treinando o modelo ARIMA (Isso pode levar alguns segundos)...")
def treinar_modelo_arima(serie_completa, frequencia):
    ts_log = np.log1p(serie_completa)
    m = 12 if frequencia == "mensal" else 1
    modelo = auto_arima(
        ts_log, 
        seasonal=(frequencia == "mensal"),
        m=step,
        D=1,
        trend='t',
        start_p=1, start_q=1,
        max_p=10, max_q=10,
        max_P=3, max_Q=3,
        stepwise=True,
        suppress_warnings=True,
        trace=False
    )
    return modelo

# === Aba 1: Entrada & Visualização ===
with abas[0]:
    st.header("Entrada de Dados")
    arquivo = st.file_uploader("Selecione o arquivo CSV", type="csv")
    
    if arquivo:
        try:
            linhas = arquivo.read().decode("ISO-8859-1").splitlines()
            arquivo.seek(0)
            header_idx = 9 if "Unidade da Federação" in linhas[9] else 8
            header_linha = linhas[header_idx].split(";")
            colunas = traduzir_meses_portugues(header_linha)
            frequencia = detectar_frequencia(header_linha) 
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
            df = df[df["Unidade da Federação"].astype(str).str.match(r"^\d{2} ")]
            estados_disponiveis = sorted(df["Unidade da Federação"].unique())
            st.session_state.df_dados = df
            st.session_state.frequencia = frequencia

            estado_selecionado = st.selectbox("Selecione o Estado:", estados_disponiveis, key="estado_input")
            linha = df[df["Unidade da Federação"] == estado_selecionado].iloc[0]
            serie = linha.drop("Unidade da Federação").astype(str).str.replace(",", ".").astype(float)
            serie = serie.replace([np.inf, -np.inf], np.nan).fillna(method='ffill').fillna(method='bfill')

            if frequencia == "anual":
                serie.index = serie.index.astype(str).str.extract(r"(\d{4})")[0].astype(int)
            else:
                serie.index = pd.to_datetime(serie.index, format="%Y/%b")
            
            st.session_state.serie = serie

            st.subheader(f"Série Histórica – {estado_selecionado}")
            st.line_chart(serie, use_container_width=True)

            if frequencia == "mensal" and len(serie) >= 24: 
                st.subheader("Análise de Decomposição (Tendência, Sazonalidade, Resíduo)")
                try:
                    decomposicao = seasonal_decompose(serie, model='additive', period=12) 
                    fig, ax = plt.subplots(4, 1, figsize=(10, 8), sharex=True)
                    decomposicao.observed.plot(ax=ax[0], title='Observado')
                    decomposicao.trend.plot(ax=ax[1], title='Tendência')
                    decomposicao.seasonal.plot(ax=ax[2], title='Sazonalidade')
                    decomposicao.resid.plot(ax=ax[3], title='Resíduo (Ruído)')
                    plt.tight_layout()
                    st.pyplot(fig)
                except Exception as e:
                    st.warning(f"Erro ao decompor a série: {e}")
            elif frequencia == "mensal":
                st.info("Série muito curta para decomposição sazonal (mínimo 24 meses).")

        except Exception as e:
            st.error(f"Erro ao processar o arquivo: {e}")
    else:
        st.info("Faça o upload de um arquivo CSV para começar.")

# === Aba 2: Previsão ===
with abas[1]:
    st.header("Previsão e Avaliação com ARIMA")
    if 'serie' in st.session_state:
        serie = st.session_state.serie
        frequencia = st.session_state.frequencia
        step = 1 if frequencia == "anual" else 12
        unidade = "anos" if frequencia == "anual" else "meses"
        n_test = 0

        if len(serie) > step * 2:
            st.subheader("Configuração de Avaliação (Treino vs. Teste)")
            n_test = st.slider(
                f"Tamanho do Conjunto de Teste (últimos {unidade}):", 
                step, 
                min(step * 3, len(serie) - step), 
                step, 
                step=step
            )
            st.info(f"Treino: **{len(serie) - n_test}**, Teste: **{n_test}**")
        else:
            st.warning("Série curta para avaliação. Apenas previsão futura será gerada.")

        st.subheader("Configuração de Previsão Futura")
        n_periods = st.slider(f"Prever quantos {unidade} à frente?", step, step * 5, step * 3, step=step)
        alpha_ci = st.slider("Nível de Confiança (%)", 80, 99, 95, 1) / 100.0
        btn = st.button("🚀 Executar Previsão")
        
        if btn:
            with st.spinner("Treinando e prevendo..."):
                try:
                    serie_log = np.log1p(serie)
                    modelo_final = treinar_modelo_arima(serie, frequencia)

                    if n_test > 0:
                        train_log = serie_log[:-n_test]
                        test = serie[-n_test:]

                        modelo_avaliacao = auto_arima(
                            train_log,
                            seasonal=(frequencia == "mensal"),
                            m=step,
                            D=1,
                            trend='t',
                            start_p=1, start_q=1,
                            max_p=10, max_q=10,
                            max_P=3, max_Q=3,
                            stepwise=True,
                            suppress_warnings=True,
                            trace=False
                        )

                        forecast_log_test = modelo_avaliacao.predict(n_periods=n_test)
                        forecast_test = np.expm1(forecast_log_test)
                        forecast_test = np.clip(forecast_test, a_min=0, a_max=None)
                        rmse = np.sqrt(mean_squared_error(test, forecast_test))

                        st.subheader("Avaliação")
                        st.metric("RMSE", f"{rmse:,.2f}")
                        df_avaliacao = pd.DataFrame({
                            "Real": test,
                            "Previsto (Teste)": pd.Series(forecast_test, index=test.index)
                        })
                        st.line_chart(df_avaliacao, use_container_width=True)
                        st.markdown("---")

                    forecast_log, conf_int_log = modelo_final.predict(
                        n_periods=n_periods, 
                        return_conf_int=True, 
                        alpha=1 - alpha_ci
                    )
                    forecast = np.expm1(forecast_log)
                    conf_int = np.expm1(conf_int_log)
                    forecast = np.clip(forecast, 0, None)
                    conf_int = np.clip(conf_int, 0, None)

                    if frequencia == "anual":
                        last_year = serie.index.max()
                        index_futuro = pd.Index([last_year + i for i in range(1, n_periods + 1)])
                    else:
                        index_futuro = pd.date_range(
                            start=serie.index.max() + pd.DateOffset(months=1),
                            periods=n_periods,
                            freq="MS"
                        )

                    previsao = pd.Series(forecast, index=index_futuro, name="Previsão")
                    df_plot = pd.DataFrame({
                        "Histórico": serie,
                        "Previsão": pd.concat([serie.tail(1), previsao]),
                        f"Limite Inferior ({alpha_ci*100:.0f}%)": pd.Series(conf_int[:, 0], index=index_futuro),
                        f"Limite Superior ({alpha_ci*100:.0f}%)": pd.Series(conf_int[:, 1], index=index_futuro)
                    })

                    st.subheader("Previsão Futura com Intervalo de Confiança")
                    st.line_chart(df_plot, use_container_width=True)

                    with st.expander("Tabela de Previsão"):
                        df_tabela = df_plot.loc[index_futuro].copy()
                        df_tabela.index.name = "Período"
                        df_tabela = df_tabela.rename(columns={"Previsão": "Previsão (Média)"})
                        st.dataframe(df_tabela, use_container_width=True)

                    with st.expander("Parâmetros do Modelo Final"):
                        st.metric("ARIMA (p,d,q)", f"{modelo_final.order}")
                        st.metric("ARIMA Sazonal (P,D,Q)m", f"{modelo_final.seasonal_order}")

                except Exception as e:
                    st.error(f"Erro durante a previsão: {e}")
    else:
        st.info("Primeiro, envie e selecione um Estado na aba 'Entrada & Visualização'.")