# Integração DATASUS (R → Rust → Python/ARIMA)

Este projeto faz uma cadeia única:

1) **R (microdatasus)** baixa os microdados do DATASUS e gera um CSV no formato **"TABNET-like"** (com metadados + cabeçalho), e também um CSV **limpo** (tidy) para Excel/BI.  
2) **Rust** oferece um **menu interativo** (sem pedir caminhos de arquivo) e orquestra as execuções.  
3) **Python (ccnt2.py)** lê o CSV TABNET-like e executa **ARIMA (auto_arima)**, gerando um **JSON** com histórico + previsão.

---

## Requisitos

### 1) R
- R instalado (versão recente) com o executável **`Rscript`** disponível no PATH.
- Pacotes:

```r
install.packages(c("microdatasus", "dplyr", "tidyr", "lubridate"))
```

> Observação: o `microdatasus` faz download/parse de arquivos `.dbc` — pode demorar dependendo do período/UF.

### 2) Python
- Python 3.9+ (recomendado) no PATH.
- Bibliotecas do **ccnt2.py**:

```bash
pip install numpy pandas pmdarima
```

### 3) Rust
- Rust + Cargo instalados (via rustup).

---

## Como rodar (passo a passo)

### 1) Entre na pasta do projeto

```bash
cd integracao
```

### 2) Execute o menu (modo recomendado)

```bash
cargo run --release
```

Se você precisar mudar comandos (ex.: `python` vs `py`) ou caminhos (caso execute fora da pasta do projeto), use flags:

```bash
cargo run --release -- \
  --rscript Rscript \
  --rfile datasus_export_tabnet_csv.R \
  --python python \
  --pyfile ccnt2.py \
  --out-dir resultados
```

- O menu **NÃO solicita caminhos de arquivo**.
- Você escolhe:
  - UF
  - Tipo de análise (ex.: Óbitos/SIM, Internações/SIH)
  - Condição crônica não transmissível (DCNT)
  - Período (ano inicial e final)
  - Parâmetros do ARIMA (anos e alpha)

### 3) Onde ficam as saídas

Ao confirmar a execução, uma pasta é criada automaticamente:

```
resultados/<DATA>-<DOENCA>-<TIPO>
```

Exemplo (compatível com Windows/Linux):

```
resultados/23-01-2026-diabetes-obitos/
```

Dentro dela:
- `dados_tabnet.csv`  → TABNET-like (compatível com `ccnt2.py`)
- `dados_limpos.csv`  → CSV tidy (Excel/BI)
- `saida_previsao.json` → histórico + previsão (ARIMA)

> Nota sobre a data: o exemplo do enunciado foi `01/01/2026`, mas `/` não é permitido em nomes de pastas no Windows. Por isso o projeto usa `DD-MM-AAAA`.

---

## O que está acontecendo (explicação da integração)

### R (datasus_export_tabnet_csv.R)
- Recebe parâmetros (UF, período, sistema e CID-10 por prefixo).
- Baixa dados via `fetch_datasus()`.
- Processa:
  - SIM-*: `process_sim()` → data `DTOBITO` e CID `CAUSABAS`.
  - SIH-RD: `process_sih()` → data de internação (`DT_INTER` ou equivalente) e CID principal (`DIAG_PRINC` ou equivalente).
- Filtra por CID-10 (prefixos) e agrega por ano (ou mês, se necessário).
- Gera:
  - CSV TABNET-like (metadados + cabeçalho na linha 10)
  - CSV limpo (tidy)

### Rust (src/main.rs)
- Exibe um menu com busca (FuzzySelect) para UF e doença.
- Monta automaticamente:
  - Parâmetros do R
  - Parâmetros do Python
  - Estrutura de pastas de saída
- Executa `Rscript ...datasus_export_tabnet_csv.R ...` e depois `python ccnt2.py ...`.

### Python (ccnt2.py)
- Lê o CSV TABNET-like.
- Constrói série temporal (anual; se vier mensal, agrega por ano).
- Ajusta ARIMA (`auto_arima`) em `log1p`.
- Produz `saida_previsao.json` com:
  - `dados_originais` (histórico)
  - `previsao` (valores e intervalo de confiança)

---

## Debug opcional (sem Rust)

Se quiser testar rapidamente só R → Python:

```bash
python panel_debug.py
```

---

## Dicas rápidas de troubleshooting

- **Rscript não encontrado**: instale o R e garanta que `Rscript` está no PATH.
- **Pacote microdatasus**: instale no R e verifique se a internet está ok (o pacote baixa arquivos `.dbc`).
- **pmdarima falha ao instalar**: atualize pip e instale wheel/build tools.
