# OCCNT Backend

Backend unico com FastAPI + Jinja2 para o pipeline:

`DATASUS/R -> CSV salvo no backend -> previsao -> visualizacao no painel`

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
  static/
    dashboard.css
    dashboard.js
  templates/
    dashboard.html
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

Se o servidor subir corretamente, abra no navegador:

- Painel: `http://127.0.0.1:8000`
- Docs da API: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

## Fluxo do painel

1. Aba `Exportar`
   - roda o script `export_datasus_database.R` pelo backend;
   - ou recebe um CSV manual e salva na base local.
2. Aba `Prever`
   - escolhe o dataset salvo;
   - roda ARIMA ou Theta;
   - grava o JSON em `backend/data/processed`.
3. Aba `Visualizar`
   - reabre datasets e resultados processados;
   - mostra preview e grafico da serie com previsao conectada.

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
