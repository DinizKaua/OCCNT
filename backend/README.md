# OCCNT Backend

Backend API-only em FastAPI para o pipeline:

`DATASUS/R -> CSV salvo no backend -> previsao -> frontend React`

## Estrutura

```text
backend/
  app/
    api/
    services/
      forecast/
    config.py
    schemas.py
    ui_options.py
    main.py
  data/
    exports/
    processed/
    samples/
  scripts/
    export_datasus_database.R
    run_prediction.py
  main.py
```

## Instalar dependencias

No PowerShell, a partir da raiz do projeto:

```powershell
python -m pip install -r backend/requirements.txt
```

## Iniciar o backend

No PowerShell:

```powershell
cd backend
python -m uvicorn main:app --reload
```

Se voce instalou o R depois de abrir o terminal, reinicie o backend para ele refazer a deteccao do `Rscript`.
Se preferir fixar o caminho manualmente na sessao atual do PowerShell:

```powershell
$env:RSCRIPT_PATH="C:\Program Files\R\R-4.5.3\bin\x64\Rscript.exe"
cd backend
python -m uvicorn main:app --reload
```

Se o servidor subir corretamente, abra no navegador:

- API raiz: `http://127.0.0.1:8000`
- Docs da API: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`
- Opcoes de UI: `http://127.0.0.1:8000/api/ui/options`

## Fluxo esperado

1. O frontend React consome a API do FastAPI.
2. O endpoint `/api/export` roda o script `export_datasus_database.R` e salva os CSVs.
3. O endpoint `/api/predict` executa ARIMA ou Theta e grava o JSON em `backend/data/processed`.
4. O frontend renderiza preview, historico e previsoes sem Jinja2.

## Exportacao manual em R

```powershell
& "C:\Program Files\R\R-4.5.2\bin\x64\Rscript.exe" --vanilla backend/scripts/export_datasus_database.R `
  --system SIM-DO `
  --uf MA `
  --year-start 2018 `
  --year-end 2022 `
  --granularity month `
  --out backend/data/exports/manual/tabnet_monthly.csv `
  --out-clean backend/data/exports/manual/dataset_tidy.csv
```

## Previsao manual por CLI

```powershell
python backend/scripts/run_prediction.py `
  --csv backend/data/exports/manual/dataset_tidy.csv `
  --state 21 `
  --mode auto `
  --model arima `
  --output -
```
