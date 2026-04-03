import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"

import Footer from "../components/Footer"
import ForecastChart from "../components/ForecastChart"
import Navbar from "../components/Navbar"
import { getDiseaseBySlug } from "../data/diseases"
import { api } from "../lib/api"

const EMPTY_EXPORT_FORM = {
  system: "SIM-DO",
  uf: "MA",
  year_start: 2018,
  year_end: 2022,
  granularity: "year",
  month_start: 1,
  month_end: 12,
  icd_prefix: "",
}

const EMPTY_PREDICT_FORM = {
  state: "21",
  mode: "auto",
  model: "arima",
  forecast_years: 3,
  forecast_periods: 12,
  confidence: 0.95,
  seasonal: "auto",
}

function DiseaseDetail() {
  const { slug } = useParams()
  const disease = getDiseaseBySlug(slug)

  const [uiOptions, setUiOptions] = useState(null)
  const [runtime, setRuntime] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [exportHistory, setExportHistory] = useState([])
  const [processedResults, setProcessedResults] = useState([])
  const [selectedDataset, setSelectedDataset] = useState("")
  const [preview, setPreview] = useState(null)
  const [prediction, setPrediction] = useState(null)
  const [loadedResult, setLoadedResult] = useState(null)
  const [lastExport, setLastExport] = useState(null)
  const [exportForm, setExportForm] = useState(EMPTY_EXPORT_FORM)
  const [predictForm, setPredictForm] = useState(EMPTY_PREDICT_FORM)
  const [busy, setBusy] = useState({ bootstrap: true, export: false, predict: false, dataset: false, result: false })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [slug])

  useEffect(() => {
    if (!disease) {
      setBusy((current) => ({ ...current, bootstrap: false }))
      return
    }

    let active = true

    async function bootstrap() {
      try {
        const [options, runtimeInfo, datasetItems, exportItems, resultItems] = await Promise.all([
          api.getUiOptions(),
          api.getRuntime(),
          api.getDatasets(),
          api.getExportHistory(),
          api.getResults(),
        ])

        if (!active) {
          return
        }

        const nextExportForm = buildExportForm(options, disease)
        const nextPredictForm = buildPredictForm(options, disease, nextExportForm.uf)
        const recommendedDataset = resolveRecommendedDataset(exportItems, datasetItems, disease)

        setUiOptions(options)
        setRuntime(runtimeInfo)
        setDatasets(datasetItems)
        setExportHistory(exportItems)
        setProcessedResults(resultItems)
        setExportForm(nextExportForm)
        setPredictForm(nextPredictForm)
        setSelectedDataset(recommendedDataset)

        if (!recommendedDataset) {
          setSuccess("Selecione ou gere uma base DATASUS para iniciar a previsao desta doenca.")
          return
        }

        const previewData = await api.getDatasetPreview(recommendedDataset, 8)
        if (!active) {
          return
        }

        setPreview(previewData)

        const saved = resultItems.find((item) => item.dataset_file === recommendedDataset)
        if (saved) {
          const detail = await api.getResultDetail(saved.result_file)
          if (!active) {
            return
          }

          setLoadedResult(detail)
          setPrediction(detail.result)
          setPredictForm((current) => applySavedRequest(current, detail.request))
          setSuccess("Carregamos a ultima previsao salva desta doenca.")
          return
        }

        const freshPrediction = await api.predict(buildPredictionPayload(nextPredictForm, recommendedDataset))
        if (!active) {
          return
        }

        setPrediction(freshPrediction)
        setProcessedResults(await api.getResults())
        setSuccess("Base encontrada e previsao padrao executada automaticamente.")
      } catch (requestError) {
        if (active) {
          setError(requestError.message)
        }
      } finally {
        if (active) {
          setBusy((current) => ({ ...current, bootstrap: false }))
        }
      }
    }

    bootstrap()

    return () => {
      active = false
    }
  }, [disease, slug])

  if (!disease) {
    return (
      <div className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-24">
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Doenca nao encontrada</p>
            <h1 className="mt-4 text-4xl font-extrabold text-[#001b3c]">Nao encontramos essa pagina.</h1>
            <Link to="/" className="mt-8 inline-flex rounded-2xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-container">
              Voltar para a home
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const selectedDatasetInfo = datasets.find((item) => item.file_id === selectedDataset)
  const relatedExports = exportHistory.filter((item) => matchesDisease(item.icd_prefix || item.preferred_dataset_file, disease)).slice(0, 3)
  const relatedResults = processedResults.filter((item) => item.dataset_file === selectedDataset || matchesDisease(item.dataset_file, disease)).slice(0, 3)
  const sortedDatasets = [...datasets].sort((left, right) => Number(matchesDisease(right.file_id, disease)) - Number(matchesDisease(left.file_id, disease)))
  const metrics = [
    { label: "Ultimo observado", value: formatNumber(prediction?.last_observed), sub: prediction?.state_label || "Sem serie carregada" },
    { label: "Pico historico", value: formatNumber(prediction?.peak_observed), sub: selectedDatasetInfo?.display_name || "Aguardando base" },
    { label: "Pontos previstos", value: prediction?.forecast_points ?? 0, sub: prediction?.model || "Modelo padrao" },
    { label: "Resultado salvo", value: loadedResult?.saved_at ? formatDate(loadedResult.saved_at) : "Sessao atual", sub: lastExport?.dataset_name || "Sem nova exportacao" },
  ]

  function changeExport(field, value) {
    setExportForm((current) => ({ ...current, [field]: parseField(field, value) }))
  }

  function changePredict(field, value) {
    setPredictForm((current) => ({ ...current, [field]: parseField(field, value) }))
  }

  async function handleExportSubmit(event) {
    event.preventDefault()
    setBusy((current) => ({ ...current, export: true }))
    setError("")
    setSuccess("")

    try {
      const exported = await api.exportFromDatasus({ ...exportForm, icd_prefix: exportForm.icd_prefix.trim() })
      const basePredictForm = buildPredictForm(uiOptions, disease, exportForm.uf)

      setLastExport(exported)
      setSelectedDataset(exported.preferred_dataset_file)
      setPreview(await api.getDatasetPreview(exported.preferred_dataset_file, 8))
      setPredictForm(basePredictForm)

      await runPrediction(exported.preferred_dataset_file, basePredictForm, "Base importada e previsao padrao concluida.")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, export: false }))
    }
  }

  async function handleCustomPredictionSubmit(event) {
    event.preventDefault()
    if (!selectedDataset) {
      setError("Selecione um dataset antes de rodar uma previsao personalizada.")
      return
    }

    await runPrediction(selectedDataset, predictForm, "Previsao personalizada atualizada.")
  }

  async function handleDatasetSelection(fileId) {
    setSelectedDataset(fileId)
    setLoadedResult(null)
    setPrediction(null)
    setError("")
    setSuccess("")

    if (!fileId) {
      setPreview(null)
      return
    }

    setBusy((current) => ({ ...current, dataset: true }))

    try {
      setPreview(await api.getDatasetPreview(fileId, 8))

      const saved = processedResults.find((item) => item.dataset_file === fileId)
      if (saved) {
        await handleLoadSavedResult(saved.result_file, true)
        setSuccess("Dataset ativado com o ultimo resultado salvo encontrado.")
      } else {
        const basePredictForm = buildPredictForm(uiOptions, disease, exportForm.uf)
        setPredictForm(basePredictForm)
        await runPrediction(fileId, basePredictForm, "Dataset ativado e previsao base executada.")
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, dataset: false }))
    }
  }

  async function handleLoadSavedResult(resultFile, silent = false) {
    setBusy((current) => ({ ...current, result: true }))
    setError("")

    try {
      const detail = await api.getResultDetail(resultFile)
      setLoadedResult(detail)
      setSelectedDataset(detail.dataset_file || "")
      setPrediction(detail.result)
      setPredictForm((current) => applySavedRequest(current, detail.request))

      if (detail.dataset_file) {
        setPreview(await api.getDatasetPreview(detail.dataset_file, 8))
      }

      if (!silent) {
        setSuccess("Resultado salvo carregado com sucesso.")
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, result: false }))
    }
  }

  async function runPrediction(datasetFile, formValues, message) {
    setBusy((current) => ({ ...current, predict: true }))
    setError("")

    try {
      const nextPrediction = await api.predict(buildPredictionPayload(formValues, datasetFile))
      const [runtimeInfo, datasetItems, exportItems, resultItems] = await Promise.all([
        api.getRuntime(),
        api.getDatasets(),
        api.getExportHistory(),
        api.getResults(),
      ])

      setPrediction(nextPrediction)
      setLoadedResult(null)
      setRuntime(runtimeInfo)
      setDatasets(datasetItems)
      setExportHistory(exportItems)
      setProcessedResults(resultItems)
      setSuccess(message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, predict: false }))
    }
  }

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="pb-24">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary via-[#003d78] to-[#5f9fd5] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.18),transparent_34%)]"></div>
          <div className="relative mx-auto max-w-7xl px-6 py-16 lg:py-20">
            <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/10">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Voltar para indicadores
            </Link>
            <div className="mt-8 grid gap-8 lg:grid-cols-12">
              <div className="lg:col-span-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.26em] text-cyan-100">
                  <span className="material-symbols-outlined text-sm">{disease.icon}</span>
                  Painel React + FastAPI
                </div>
                <h1 className="mt-5 text-4xl font-extrabold leading-tight md:text-6xl">{disease.title}</h1>
                <p className="mt-5 max-w-3xl text-base leading-8 text-blue-50/90 md:text-lg">{disease.summary}</p>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-blue-100/85 md:text-base">{disease.context}</p>
              </div>
              <div className="grid gap-4 lg:col-span-5">
                <div className="rounded-[28px] border border-white/15 bg-white/10 p-6 backdrop-blur-md">
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-100">Filtro ativo</p>
                  <p className="mt-3 text-3xl font-black">{disease.cidLabel}</p>
                  <p className="mt-3 text-sm leading-7 text-blue-50/85">{disease.insight}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  {disease.focusCards.map((item) => (
                    <div key={item.title} className="rounded-[24px] border border-white/12 bg-slate-950/20 p-5 backdrop-blur-md">
                      <span className="material-symbols-outlined text-3xl text-cyan-200">{item.icon}</span>
                      <h2 className="mt-4 text-base font-bold">{item.title}</h2>
                      <p className="mt-2 text-sm leading-6 text-blue-100/85">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="relative -mt-10">
          <div className="mx-auto max-w-7xl space-y-6 px-6">
            {error ? <Notice tone="error">{error}</Notice> : null}
            {success ? <Notice tone="success">{success}</Notice> : null}
            {busy.bootstrap ? <Notice tone="info">Carregando opcoes da API, datasets e resultados processados.</Notice> : null}

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="space-y-6 lg:col-span-5">
                <Panel kicker="1. Fonte DATASUS" title="Gerar base e prever automaticamente" badge={runtime?.rscript_ready ? "Rscript detectado" : "Rscript pendente"}>
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={handleExportSubmit}>
                    <Field label="Sistema" value={exportForm.system} onChange={(value) => changeExport("system", value)} options={uiOptions?.system_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
                    <Field label="UF" value={exportForm.uf} onChange={(value) => changeExport("uf", value)} options={uiOptions?.uf_options?.map((item) => ({ value: item.sigla, label: `${item.sigla} - ${item.name}` })) ?? []} />
                    <Field label="Ano inicial" value={exportForm.year_start} onChange={(value) => changeExport("year_start", value)} options={(uiOptions?.year_options ?? []).map((item) => ({ value: item, label: item }))} />
                    <Field label="Ano final" value={exportForm.year_end} onChange={(value) => changeExport("year_end", value)} options={(uiOptions?.year_options ?? []).map((item) => ({ value: item, label: item }))} />
                    <Field label="Granularidade" value={exportForm.granularity} onChange={(value) => changeExport("granularity", value)} options={uiOptions?.granularity_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
                    <label className="block md:col-span-2">
                      <span className="text-sm font-semibold text-[#001b3c]">CID sugerido pela pagina</span>
                      <input className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary" value={exportForm.icd_prefix} onChange={(event) => changeExport("icd_prefix", event.target.value)} placeholder="Ex.: I10,I11,I12" />
                    </label>
                    {exportForm.granularity === "month" ? (
                      <>
                        <Field label="Mes inicial" value={exportForm.month_start} onChange={(value) => changeExport("month_start", value)} options={(uiOptions?.month_options ?? []).map((item) => ({ value: item, label: item }))} />
                        <Field label="Mes final" value={exportForm.month_end} onChange={(value) => changeExport("month_end", value)} options={(uiOptions?.month_options ?? []).map((item) => ({ value: item, label: item }))} />
                      </>
                    ) : null}
                    <div className="rounded-[24px] border border-slate-200 bg-surface-container-low p-4 text-sm text-on-surface-variant md:col-span-2">
                      A exportacao aplica o filtro da doenca clicada, atualiza o dataset ativo e dispara a previsao padrao do backend.
                    </div>
                    <button type="submit" disabled={busy.export || busy.bootstrap} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-bold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
                      <span className="material-symbols-outlined">bolt</span>
                      {busy.export ? "Gerando base e previsao..." : "Exportar do DATASUS e prever"}
                    </button>
                  </form>
                </Panel>

                <Panel kicker="2. Base ativa" title="Selecionar dataset e recuperar historico" badge={`${datasets.length} datasets`}>
                  <label className="block">
                    <span className="text-sm font-semibold text-[#001b3c]">Dataset disponivel</span>
                    <select className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary" value={selectedDataset} onChange={(event) => handleDatasetSelection(event.target.value)}>
                      <option value="">Selecione um dataset salvo</option>
                      {sortedDatasets.map((item) => (
                        <option key={item.file_id} value={item.file_id}>
                          {item.display_name || item.file_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <MiniCard label="Layout" value={selectedDatasetInfo?.layout || "Aguardando base"} icon="view_column" />
                    <MiniCard label="Frequencia" value={selectedDatasetInfo?.frequency || "Indefinida"} icon="schedule" />
                  </div>

                  <HistoryList title="Ultimas exportacoes relacionadas" items={relatedExports} empty="Ainda nao ha exportacoes especificas desta doenca. Gere a primeira acima." kind="export" onPick={() => {}} />
                  <HistoryList title="Resultados processados" items={relatedResults} empty="Os resultados salvos vao aparecer aqui depois da primeira previsao." kind="result" onPick={handleLoadSavedResult} />
                </Panel>
              </div>

              <div className="space-y-6 lg:col-span-7">
                <Panel kicker="3. Painel de previsao" title="Leitura visual do backend" badge={prediction?.output_frequency ? `Saida ${prediction.output_frequency}` : "Sem previsao"}>
                  <ForecastChart prediction={prediction} />

                  <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {metrics.map((item) => (
                      <div key={item.label} className="rounded-[24px] border border-slate-200 bg-surface-container-low p-5">
                        <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{item.label}</p>
                        <p className="mt-3 text-3xl font-black text-[#001b3c]">{item.value}</p>
                        <p className="mt-2 text-sm leading-6 text-on-surface-variant">{item.sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-3">
                    {prediction?.forecast?.length ? (
                      prediction.forecast.slice(0, 6).map((item) => (
                        <div key={item.year || item.month} className="rounded-[24px] border border-slate-200 bg-surface-container-low p-5">
                          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{item.year || item.month}</p>
                          <p className="mt-3 text-2xl font-black text-[#001b3c]">{formatNumber(item.value)}</p>
                          <p className="mt-2 text-sm text-on-surface-variant">Faixa: {formatNumber(item.lower)} a {formatNumber(item.upper)}</p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-[24px] border border-dashed border-slate-300 bg-surface-container-low p-6 lg:col-span-3">
                        <p className="font-semibold text-[#001b3c]">Nenhuma projecao disponivel ainda.</p>
                        <p className="mt-2 text-sm text-on-surface-variant">Gere a previsao automatica acima ou rode uma simulacao personalizada abaixo.</p>
                      </div>
                    )}
                  </div>
                </Panel>

                <Panel kicker="4. Ajuste personalizado" title="Editar a previsao depois do resultado base" badge="Backend pronto para reprocessar">
                  <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCustomPredictionSubmit}>
                    <Field label="Estado" value={predictForm.state} onChange={(value) => changePredict("state", value)} options={uiOptions?.state_options ?? []} />
                    <Field label="Modo de saida" value={predictForm.mode} onChange={(value) => changePredict("mode", value)} options={uiOptions?.mode_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
                    <Field label="Modelo" value={predictForm.model} onChange={(value) => changePredict("model", value)} options={uiOptions?.model_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
                    <Field label="Confianca" value={predictForm.confidence} onChange={(value) => changePredict("confidence", value)} options={(uiOptions?.confidence_options ?? []).map((item) => ({ value: item, label: `${Math.round(item * 100)}%` }))} />
                    <Field label="Horizonte em anos" value={predictForm.forecast_years} onChange={(value) => changePredict("forecast_years", value)} options={(uiOptions?.forecast_year_options ?? []).map((item) => ({ value: item, label: item }))} />
                    <Field label="Periodos futuros" value={predictForm.forecast_periods} onChange={(value) => changePredict("forecast_periods", value)} options={(uiOptions?.forecast_period_options ?? []).map((item) => ({ value: item, label: item }))} />
                    <Field label="Sazonalidade" value={predictForm.seasonal} onChange={(value) => changePredict("seasonal", value)} options={uiOptions?.seasonal_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
                    <div className="rounded-[24px] bg-surface-container-low p-4 md:col-span-2">
                      <p className="text-sm font-semibold text-[#001b3c]">Base selecionada</p>
                      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{selectedDatasetInfo?.display_name || selectedDataset || "Nenhum dataset ativo no momento."}</p>
                    </div>
                    <button type="submit" disabled={!selectedDataset || busy.predict} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#001b3c] px-5 py-4 font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
                      <span className="material-symbols-outlined">insights</span>
                      {busy.predict ? "Reprocessando previsao..." : "Rodar previsao personalizada"}
                    </button>
                  </form>
                </Panel>

                <Panel kicker="5. Preview da base" title="Amostra do CSV usado pelo backend" badge={`${preview?.rows?.length ?? 0} linhas exibidas`}>
                  <div className="overflow-x-auto rounded-[24px] border border-slate-200">
                    {preview?.columns?.length ? (
                      <table className="min-w-full divide-y divide-slate-200 text-sm">
                        <thead className="bg-surface-container-low">
                          <tr>
                            {preview.columns.map((column) => (
                              <th key={column} className="px-4 py-3 text-left font-semibold text-[#001b3c]">{column}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {preview.rows.map((row, rowIndex) => (
                            <tr key={`${rowIndex}-${row.join("-")}`}>
                              {row.map((cell, cellIndex) => (
                                <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-on-surface-variant">{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8">
                        <p className="font-semibold text-[#001b3c]">Nenhum preview disponivel.</p>
                        <p className="mt-2 text-sm text-on-surface-variant">Assim que um dataset for ativado, mostramos aqui uma amostra dos dados que alimentam a previsao.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <MiniCard label="Atualizacao do dataset" value={selectedDatasetInfo?.updated_at || "Sem data"} icon="update" />
                    <MiniCard label="Processamento salvo" value={loadedResult?.saved_at ? formatDate(loadedResult.saved_at) : "Ainda nao salvo"} icon="save" />
                  </div>
                </Panel>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

function buildExportForm(uiOptions, disease) {
  const defaults = uiOptions?.defaults?.export ?? EMPTY_EXPORT_FORM
  return { ...defaults, ...disease.exportDefaults }
}

function buildPredictForm(uiOptions, disease, ufSigla) {
  const defaults = uiOptions?.defaults?.predict ?? EMPTY_PREDICT_FORM
  const stateCode = lookupStateCode(uiOptions, ufSigla) ?? defaults.state
  return { ...defaults, state: stateCode, ...disease.predictDefaults }
}

function resolveRecommendedDataset(exportItems, datasets, disease) {
  const exact = exportItems.find((item) => normalizeIcd(item.icd_prefix) === normalizeIcd(disease.exportDefaults.icd_prefix))
  if (exact?.preferred_dataset_file) {
    return exact.preferred_dataset_file
  }

  const token = disease.exportDefaults.icd_prefix.split(",")[0]?.trim().toLowerCase()
  return datasets.find((item) => item.file_id.toLowerCase().includes(token))?.file_id ?? ""
}

function normalizeIcd(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "")
}

function lookupStateCode(uiOptions, ufSigla) {
  return (uiOptions?.uf_options ?? []).find((item) => item.sigla === ufSigla)?.code ?? null
}

function buildPredictionPayload(formValues, datasetFile) {
  return {
    dataset_file: datasetFile,
    state: String(formValues.state),
    mode: formValues.mode,
    model: formValues.model,
    forecast_years: Number(formValues.forecast_years),
    forecast_periods: Number(formValues.forecast_periods),
    confidence: Number(formValues.confidence),
    seasonal: formValues.seasonal === "true" ? true : formValues.seasonal === "false" ? false : null,
  }
}

function applySavedRequest(current, request) {
  return {
    ...current,
    state: String(request?.state ?? current.state),
    mode: request?.mode ?? current.mode,
    model: request?.model ?? current.model,
    forecast_years: Number(request?.forecast_years ?? current.forecast_years),
    forecast_periods: Number(request?.forecast_periods ?? current.forecast_periods),
    confidence: Number(request?.confidence ?? current.confidence),
    seasonal: request?.seasonal === true ? "true" : request?.seasonal === false ? "false" : "auto",
  }
}

function matchesDisease(value, disease) {
  const haystack = String(value || "").toLowerCase()
  const token = disease.exportDefaults.icd_prefix.split(",")[0]?.trim().toLowerCase()
  return haystack.includes(disease.slug) || haystack.includes(token)
}

function parseField(field, value) {
  if (["year_start", "year_end", "month_start", "month_end", "forecast_years", "forecast_periods"].includes(field)) {
    return Number(value)
  }

  if (field === "confidence") {
    return Number(value)
  }

  return value
}

function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return "--"
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(value) {
  if (!value) {
    return "--"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR")
}

function Notice({ children, tone }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-slate-200 bg-white text-on-surface-variant",
  }

  return <div className={`rounded-[24px] border px-5 py-4 text-sm font-medium shadow-sm ${tones[tone]}`}>{children}</div>
}

function Panel({ kicker, title, badge, children }) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-7 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-primary">{kicker}</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#001b3c]">{title}</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700">{badge}</span>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function Field({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-[#001b3c]">{label}</span>
      <select className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={`${label}-${option.value}`} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function MiniCard({ label, value, icon }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-surface-container-low p-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{label}</p>
          <p className="mt-1 font-semibold text-[#001b3c]">{value}</p>
        </div>
      </div>
    </div>
  )
}

function HistoryList({ title, items, empty, kind, onPick }) {
  return (
    <div className="mt-6 rounded-[24px] bg-surface-container-low p-4">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{title}</p>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map((item) =>
            kind === "result" ? (
              <button key={item.result_file} type="button" onClick={() => onPick(item.result_file)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-primary/40">
                <p className="font-semibold text-[#001b3c]">{item.model}</p>
                <p className="mt-1 text-xs text-on-surface-variant">{item.state_label} | {formatDate(item.saved_at)}</p>
              </button>
            ) : (
              <div key={item.dataset_name} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-[#001b3c]">{item.dataset_name}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">{item.uf} | {item.granularity} | {formatDate(item.created_at)}</p>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{item.icd_prefix || "sem CID"}</span>
                </div>
              </div>
            )
          )
        ) : (
          <p className="text-sm text-on-surface-variant">{empty}</p>
        )}
      </div>
    </div>
  )
}

export default DiseaseDetail
