import { useEffect, useRef, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"

import Footer from "../components/Footer"
import ForecastChart from "../components/ForecastChart"
import Navbar from "../components/Navbar"
import { BlockFooter, Notice, PanelShell, SelectField } from "../components/disease/DiseaseUi"
import { allDiseases, getDiseaseBySlug } from "../data/diseases"
import { api } from "../lib/api"
import {
  BLOCKS,
  EMPTY_EXPORT_FORM,
  EMPTY_PREDICT_FORM,
  applySavedRequest,
  buildDatasetName,
  buildExportForm,
  buildPredictionPayload,
  buildPredictForm,
  formatDate,
  formatNumber,
  getAvailableMonthOptions,
  getAvailableYearOptions,
  getModeOptions,
  normalizeExportForm,
  normalizePredictForm,
  parseField,
} from "../lib/diseaseUtils"
import { exportVisualizationJson, exportVisualizationPdf } from "../lib/reportExport"

const STEP_ITEMS = [
  { id: BLOCKS.import, title: "Importar" },
  { id: BLOCKS.prediction, title: "Prever" },
  { id: BLOCKS.visualization, title: "Visualizar" },
]

const CONTROL_CLASS_NAME = "mt-3 w-full rounded-2xl border border-[#cfe1f5] bg-[#f7fbff] px-4 py-3 text-sm font-medium text-[#0b2545] outline-none shadow-sm transition focus:border-primary focus:ring-4 focus:ring-primary/10"

function DiseaseDetail() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const chartRef = useRef(null)
  const disease = getDiseaseBySlug(slug)

  const [uiOptions, setUiOptions] = useState(null)
  const [datasets, setDatasets] = useState([])
  const [results, setResults] = useState([])
  const [availability, setAvailability] = useState(null)
  const [selectedDatasetId, setSelectedDatasetId] = useState("")
  const [selectedForecastId, setSelectedForecastId] = useState("")
  const [predictionDetail, setPredictionDetail] = useState(null)
  const [exportForm, setExportForm] = useState(EMPTY_EXPORT_FORM)
  const [predictForm, setPredictForm] = useState(EMPTY_PREDICT_FORM)
  const [activeBlock, setActiveBlock] = useState(BLOCKS.import)
  const [busy, setBusy] = useState({ bootstrap: true, export: false, dataset: false, predict: false, forecast: false, download: false })
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" })
    setActiveBlock(BLOCKS.import)
  }, [slug])

  useEffect(() => {
    if (!disease) {
      setBusy((current) => ({ ...current, bootstrap: false }))
      return
    }

    let active = true

    async function bootstrap() {
      setBusy((current) => ({ ...current, bootstrap: true }))
      setError("")
      setSuccess("")
      setPredictionDetail(null)
      setSelectedForecastId("")

      try {
        const optionsData = await api.getUiOptions()
        if (!active) return

        setUiOptions(optionsData)
        const initialAvailability = optionsData.initial_availability ?? await api.getAvailability(optionsData.defaults?.export?.system ?? "SIM-DO", optionsData.defaults?.export?.uf ?? "MA", optionsData.defaults?.export?.granularity ?? "year")
        if (!active) return

        setAvailability(initialAvailability)
        setExportForm(buildExportForm(optionsData, disease, initialAvailability))

        const basePredict = buildPredictForm(optionsData, disease)
        const settled = await Promise.allSettled([api.getDatasets(disease.slug), api.getResults(disease.slug)])
        if (!active) return

        const [datasetsResult, resultsResult] = settled
        const datasetItems = datasetsResult.status === "fulfilled" ? datasetsResult.value : []
        const resultItems = resultsResult.status === "fulfilled" ? resultsResult.value : []
        const latestDataset = datasetItems[0] ?? null
        const firstForecast = latestDataset ? resultItems.find((item) => item.dataset_id === latestDataset.dataset_id) ?? null : resultItems[0] ?? null
        const initialDatasetId = latestDataset?.dataset_id ?? firstForecast?.dataset_id ?? ""
        const initialDataset = datasetItems.find((item) => item.dataset_id === initialDatasetId) ?? null

        setDatasets(datasetItems)
        setResults(resultItems)
        setSelectedDatasetId(initialDatasetId)
        setPredictForm(normalizePredictForm(optionsData, disease, initialDataset, basePredict))

        if (firstForecast?.forecast_id) {
          const detail = await api.getResultDetail(firstForecast.forecast_id)
          if (!active) return

          const detailDataset = datasetItems.find((item) => item.dataset_id === detail.dataset_id) ?? initialDataset
          setSelectedDatasetId(detail.dataset_id)
          setSelectedForecastId(firstForecast.forecast_id)
          setPredictionDetail(detail)
          setPredictForm(normalizePredictForm(optionsData, disease, detailDataset, applySavedRequest(basePredict, detail.request)))
        }

      } catch (requestError) {
        if (active) setError(requestError.message || "Nao foi possivel carregar os dados desta pagina.")
      } finally {
        if (active) setBusy((current) => ({ ...current, bootstrap: false }))
      }
    }

    bootstrap()
    return () => {
      active = false
    }
  }, [disease, slug])

  useEffect(() => {
    if (!uiOptions) {
      return
    }

    let active = true

    async function syncAvailability() {
      try {
        const nextAvailability = await api.getAvailability(exportForm.system, exportForm.uf, exportForm.granularity)
        if (!active) return
        setAvailability(nextAvailability)
        setExportForm((current) => normalizeExportForm(uiOptions, nextAvailability, current))
      } catch (requestError) {
        if (active) {
          setAvailability(null)
          setError(requestError.message || "Nao foi possivel consultar os periodos disponiveis no DATASUS.")
        }
      }
    }

    syncAvailability()
    return () => {
      active = false
    }
  }, [exportForm.system, exportForm.uf, exportForm.granularity, uiOptions])

  async function refreshWorkspace(diseaseSlug = disease?.slug) {
    const [datasetItems, resultItems] = await Promise.all([api.getDatasets(diseaseSlug), api.getResults(diseaseSlug)])
    setDatasets(datasetItems)
    setResults(resultItems)
    return { datasetItems, resultItems }
  }

  function updateExport(field, value) {
    setExportForm((current) => normalizeExportForm(uiOptions, availability, { ...current, [field]: parseField(field, value) }, field))
  }

  function updatePredict(field, value) {
    setPredictForm((current) => normalizePredictForm(uiOptions, disease, selectedDatasetInfo, { ...current, [field]: parseField(field, value) }))
  }

  function goToBlock(block) {
    if (block === BLOCKS.prediction && !canOpenPrediction) return
    if (block === BLOCKS.visualization && !canOpenVisualization) return
    setActiveBlock(block)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function loadForecast(forecastId, nextBlock = activeBlock, silent = false) {
    if (!forecastId) {
      setSelectedForecastId("")
      setPredictionDetail(null)
      return
    }

    setBusy((current) => ({ ...current, forecast: true }))
    setError("")
    try {
      const detail = await api.getResultDetail(forecastId)
      const datasetInfo = datasets.find((item) => item.dataset_id === detail.dataset_id) ?? null
      setSelectedForecastId(forecastId)
      setSelectedDatasetId(detail.dataset_id)
      setPredictionDetail(detail)
      setPredictForm(normalizePredictForm(uiOptions, disease, datasetInfo, applySavedRequest(buildPredictForm(uiOptions, disease), detail.request)))
      setActiveBlock(nextBlock)
        if (!silent) setSuccess("Previsao carregada.")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, forecast: false }))
    }
  }

  async function runPrediction(formValues, datasetId, message) {
    const response = await api.predict(buildPredictionPayload(formValues, datasetId, disease.slug))
    const workspace = await refreshWorkspace(disease.slug)
    const detail = await api.getResultDetail(response.forecast_id)
    const datasetInfo = workspace.datasetItems.find((item) => item.dataset_id === detail.dataset_id) ?? null
    setSelectedDatasetId(detail.dataset_id)
    setSelectedForecastId(response.forecast_id)
    setPredictionDetail(detail)
    setPredictForm(normalizePredictForm(uiOptions, disease, datasetInfo, applySavedRequest(buildPredictForm(uiOptions, disease), detail.request)))
    setSuccess(message)
  }

  async function handleExportSubmit(event) {
    event.preventDefault()
    setBusy((current) => ({ ...current, export: true }))
    setError("")
    try {
      const exported = await api.exportFromDatasus({ ...exportForm, disease_slug: disease.slug, disease_title: disease.title, icd_prefix: disease.exportDefaults.icd_prefix, dataset_name: buildDatasetName(disease, exportForm) })
      const importedFrequency = exportForm.granularity === "month" ? "monthly" : "annual"
      const defaultPredict = normalizePredictForm(uiOptions, disease, { frequency: importedFrequency }, buildPredictForm(uiOptions, disease))
      setSelectedDatasetId(exported.dataset_id)
      await runPrediction(defaultPredict, exported.dataset_id, "Base importada e previsao inicial salvas.")
      setActiveBlock(BLOCKS.prediction)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, export: false }))
    }
  }

  async function handleDatasetSelection(datasetId, options = {}) {
    const { loadRelatedForecast = true, silent = false } = options
    setBusy((current) => ({ ...current, dataset: true }))
    setSelectedDatasetId(datasetId)
    setError("")
    try {
      const datasetInfo = datasets.find((item) => item.dataset_id === datasetId) ?? null
      setPredictForm((current) => normalizePredictForm(uiOptions, disease, datasetInfo, current))
      if (!datasetId) {
        setPredictionDetail(null)
        setSelectedForecastId("")
        return
      }
      const relatedForecast = results.find((item) => item.dataset_id === datasetId)
      if (relatedForecast && loadRelatedForecast) {
        await loadForecast(relatedForecast.forecast_id, activeBlock, true)
      } else {
        setPredictionDetail(null)
        setSelectedForecastId("")
        if (!silent) setSuccess("Base pronta para nova previsao.")
      }
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, dataset: false }))
    }
  }

  async function handlePredictionSubmit(event) {
    event.preventDefault()
    if (!selectedDatasetId) {
      setError("Importe ou selecione uma base antes de prever.")
      return
    }
    setBusy((current) => ({ ...current, predict: true }))
    setError("")
    try {
      await runPrediction(predictForm, selectedDatasetId, "Previsao atualizada com sucesso.")
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy((current) => ({ ...current, predict: false }))
    }
  }

  async function handlePdfExport() {
    if (!predictionDetail?.result) return
    setBusy((current) => ({ ...current, download: true }))
    try {
      await exportVisualizationPdf({ chartElement: chartRef.current, disease, dataset: selectedDatasetInfo, predictionDetail })
      setSuccess("PDF exportado.")
    } catch (requestError) {
      setError(requestError.message || "Nao foi possivel gerar o PDF.")
    } finally {
      setBusy((current) => ({ ...current, download: false }))
    }
  }

  if (!disease) {
    return (
      <div className="min-h-screen bg-background text-on-surface">
        <Navbar />
        <main className="mx-auto max-w-4xl px-6 py-24">
          <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Doenca nao encontrada</p>
            <h1 className="mt-4 text-4xl font-extrabold text-[#001b3c]">Nao encontramos essa pagina.</h1>
            <Link to="/" className="mt-8 inline-flex rounded-2xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-container">Voltar para a home</Link>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const selectedDatasetInfo = datasets.find((item) => item.dataset_id === selectedDatasetId) ?? null
  const canOpenPrediction = datasets.length > 0
  const canOpenVisualization = Boolean(predictionDetail?.result)
  const modeOptions = getModeOptions(uiOptions, selectedDatasetInfo)
  const modelOptions = uiOptions?.model_options?.map((item) => ({ value: item.value, label: item.label })) ?? []
  const confidenceOptions = (uiOptions?.confidence_options ?? []).map((item) => ({ value: item, label: `${Math.round(item * 100)}%` }))
  const annualHorizonOptions = (uiOptions?.forecast_year_options ?? []).map((item) => ({ value: item, label: item }))
  const monthlyHorizonOptions = (uiOptions?.forecast_period_options ?? []).map((item) => ({ value: item, label: item }))
  const effectiveMode = predictForm.mode === "auto" ? (selectedDatasetInfo?.frequency === "monthly" ? "monthly" : "annual") : predictForm.mode
  const usesMonthlyHorizon = effectiveMode === "monthly"
  const periodKey = predictionDetail?.result?.output_frequency === "monthly" ? "month" : "year"
  const forecastRows = predictionDetail?.result?.forecast ?? []

  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />
      <main className="pb-24">
        <section className="mx-auto max-w-5xl px-6 pt-12">
          <div className="overflow-hidden rounded-[34px] border border-[#d3e3f4] bg-gradient-to-br from-[#083766] via-[#0b4c8a] to-[#4d9cd3] p-6 text-white shadow-lg shadow-[#0b3d74]/15">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <Link to="/" className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Voltar
              </Link>

              <label className="w-full max-w-sm">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.24em] text-blue-100">Doenca</span>
                <select className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white outline-none transition focus:border-white/40" value={disease.slug} onChange={(event) => navigate(`/doencas/${event.target.value}`)}>
                  {allDiseases.map((item) => (
                    <option key={item.slug} value={item.slug} className="text-[#0b2545]">
                      {item.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-5">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/12 px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-blue-50">
                  <span className="material-symbols-outlined text-sm">{disease.icon}</span>
                  {disease.cidLabel}
                </div>
                <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-5xl">{disease.title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50/90">{disease.summary}</p>
              </div>

              <div className="rounded-[24px] border border-white/15 bg-white/10 px-4 py-3 text-sm backdrop-blur-sm">
                <p className="font-semibold text-white">{disease.systemArea}</p>
                <p className="mt-1 text-blue-50/80">{disease.context}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-6 max-w-5xl space-y-5 px-6">
          {error ? <Notice tone="error">{error}</Notice> : null}
          {success ? <Notice tone="success">{success}</Notice> : null}
          {busy.bootstrap ? <Notice tone="info">Carregando dados da doenca.</Notice> : null}

          <div className="grid gap-3 md:grid-cols-3">
            {STEP_ITEMS.map((step) => {
              const disabled = (step.id === BLOCKS.prediction && !canOpenPrediction) || (step.id === BLOCKS.visualization && !canOpenVisualization)

              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={disabled ? undefined : () => goToBlock(step.id)}
                  className={`rounded-[24px] border px-5 py-4 text-left transition ${
                    activeBlock === step.id
                      ? "border-primary bg-gradient-to-br from-primary/10 to-[#8bc6ec]/20 text-[#0b2e55]"
                      : disabled
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white text-[#0b2e55] hover:border-primary/40"
                  }`}
                >
                  <span className="block text-center text-2xl font-black tracking-tight">{step.title}</span>
                  <span className="mx-auto mt-3 block h-1.5 w-16 rounded-full bg-current/20"></span>
                </button>
              )
            })}
          </div>

          {activeBlock === BLOCKS.import ? <ImportBlock
            activeDataset={selectedDatasetInfo}
            busy={busy}
            canOpenPrediction={canOpenPrediction}
            datasets={datasets}
            disease={disease}
            exportForm={exportForm}
            onChangeDataset={handleDatasetSelection}
            onSubmit={handleExportSubmit}
            onUpdate={updateExport}
            uiOptions={uiOptions}
            availability={availability}
            onNext={() => goToBlock(BLOCKS.prediction)}
          /> : null}

          {activeBlock === BLOCKS.prediction ? <PredictionBlock
            busy={busy}
            canOpenVisualization={canOpenVisualization}
            datasets={datasets}
            modeOptions={modeOptions}
            modelOptions={modelOptions}
            confidenceOptions={confidenceOptions}
            annualHorizonOptions={annualHorizonOptions}
            monthlyHorizonOptions={monthlyHorizonOptions}
            onChangeDataset={handleDatasetSelection}
            onLoadForecast={loadForecast}
            onPrev={() => goToBlock(BLOCKS.import)}
            onSubmit={handlePredictionSubmit}
            onUpdate={updatePredict}
            predictForm={predictForm}
            results={results}
            selectedDatasetId={selectedDatasetId}
            selectedDatasetInfo={selectedDatasetInfo}
            selectedForecastId={selectedForecastId}
            usesMonthlyHorizon={usesMonthlyHorizon}
            onNext={() => goToBlock(BLOCKS.visualization)}
          /> : null}

          {activeBlock === BLOCKS.visualization ? <VisualizationBlock
            busy={busy}
            chartRef={chartRef}
            forecastRows={forecastRows}
            onExportJson={() => exportVisualizationJson({ disease, dataset: selectedDatasetInfo, predictionDetail })}
            onExportPdf={handlePdfExport}
            onLoadForecast={loadForecast}
            onPrev={() => goToBlock(BLOCKS.prediction)}
            periodKey={periodKey}
            predictionDetail={predictionDetail}
            results={results}
            selectedForecastId={selectedForecastId}
          /> : null}

          {activeBlock !== BLOCKS.visualization && predictionDetail?.result ? <QuickChart
            activeBlock={activeBlock}
            onLoadForecast={loadForecast}
            onOpenVisualization={() => goToBlock(BLOCKS.visualization)}
            predictionDetail={predictionDetail}
            results={results}
            selectedDatasetInfo={selectedDatasetInfo}
            selectedForecastId={selectedForecastId}
          /> : null}
        </section>
      </main>
      <Footer />
    </div>
  )
}

function ImportBlock({ activeDataset, availability, busy, canOpenPrediction, datasets, disease, exportForm, onChangeDataset, onSubmit, onUpdate, uiOptions, onNext }) {
  const yearValues = getAvailableYearOptions(uiOptions, availability)
  const monthValues = getAvailableMonthOptions(uiOptions, availability, exportForm.year_start)
  const yearStartOptions = yearValues.filter((item) => item <= exportForm.year_end)
  const yearEndOptions = yearValues.filter((item) => item >= exportForm.year_start)
  const monthStartOptions = getAvailableMonthOptions(uiOptions, availability, exportForm.year_start).filter((item) => exportForm.year_start !== exportForm.year_end || item <= exportForm.month_end)
  const monthEndOptions = getAvailableMonthOptions(uiOptions, availability, exportForm.year_end).filter((item) => exportForm.year_start !== exportForm.year_end || item >= exportForm.month_start)

  return (
    <PanelShell kicker="Importacao" title="Importar base" badge="Parametros principais">
      <form className="grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <SelectField label="Sistema" icon="source_environment" tone="blue" value={exportForm.system} onChange={(value) => onUpdate("system", value)} options={uiOptions?.system_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
        <SelectField label="UF" icon="public" tone="emerald" value={exportForm.uf} onChange={(value) => onUpdate("uf", value)} options={uiOptions?.uf_options?.map((item) => ({ value: item.sigla, label: item.sigla })) ?? []} />
        <SelectField label="Ano inicial" icon="calendar_month" tone="amber" helper={yearStartOptions.length ? `Disponivel de ${yearStartOptions[0]} ate ${yearStartOptions.at(-1)}.` : null} value={exportForm.year_start} onChange={(value) => onUpdate("year_start", value)} options={yearStartOptions.map((item) => ({ value: item, label: item }))} />
        <SelectField label="Ano final" icon="event_upcoming" tone="amber" helper={yearEndOptions.length ? `Ultimo ano realmente disponivel: ${yearEndOptions.at(-1)}.` : null} value={exportForm.year_end} onChange={(value) => onUpdate("year_end", value)} options={yearEndOptions.map((item) => ({ value: item, label: item }))} />
        <div className="rounded-[24px] border border-[#dceaf8] bg-gradient-to-br from-[#fff8ef] via-white to-[#eef8ff] p-4 md:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#0b4c8a]">Cobertura selecionada</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#0b4c8a] px-4 py-2 text-sm font-bold text-white">{exportForm.year_start}</span>
            <span className="text-sm font-semibold text-[#6b7d90]">ate</span>
            <span className="rounded-full bg-[#f0a202] px-4 py-2 text-sm font-bold text-white">{exportForm.year_end}</span>
            <span className="rounded-full bg-[#eaf4ff] px-4 py-2 text-xs font-bold uppercase tracking-[0.24em] text-[#0b4c8a]">{exportForm.granularity === "month" ? "Mensal" : "Anual"}</span>
          </div>
        </div>
        <SelectField label="Granularidade" icon="stacked_bar_chart" tone="violet" value={exportForm.granularity} onChange={(value) => onUpdate("granularity", value)} options={uiOptions?.granularity_options?.map((item) => ({ value: item.value, label: item.label })) ?? []} />
        <MiniInfo label="CID" value={disease.cidLabel} />

        {exportForm.granularity === "month" ? (
          <>
            <SelectField label="Mes inicial" icon="calendar_today" tone="amber" helper={monthValues.length ? `Meses reais para ${exportForm.year_start}.` : null} value={exportForm.month_start} onChange={(value) => onUpdate("month_start", value)} options={monthStartOptions.map((item) => ({ value: item, label: item }))} />
            <SelectField label="Mes final" icon="calendar_today" tone="amber" helper={monthEndOptions.length ? `Meses reais para ${exportForm.year_end}.` : null} value={exportForm.month_end} onChange={(value) => onUpdate("month_end", value)} options={monthEndOptions.map((item) => ({ value: item, label: item }))} />
          </>
        ) : null}

        <button type="submit" disabled={busy.export || busy.bootstrap} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[#0f6db5] px-5 py-4 font-bold text-white transition hover:from-primary-container hover:to-[#1784d5] disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
          <span className="material-symbols-outlined">download</span>
          {busy.export ? "Importando..." : "Importar e prever"}
        </button>
      </form>

      {datasets.length ? (
        <div className="mt-6 border-t border-slate-200 pt-6">
          <label className="block">
            <span className="text-sm font-semibold text-[#001b3c]">Base salva</span>
            <select className={CONTROL_CLASS_NAME} value={activeDataset?.dataset_id ?? ""} onChange={(event) => onChangeDataset(event.target.value, { loadRelatedForecast: true, silent: true })}>
              <option value="">Selecione</option>
              {datasets.map((item) => (
                <option key={item.dataset_id} value={item.dataset_id}>
                  {datasetLabel(item)}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-sm text-on-surface-variant">{activeDataset ? `${datasetLabel(activeDataset)} | ${activeDataset.frequency}` : "Escolha uma base salva para seguir."}</p>
        </div>
      ) : null}

      <BlockFooter previousLabel="Voltar para a home" previousTo="/" nextLabel="Prosseguir" nextDisabled={!canOpenPrediction} onNext={onNext} />
    </PanelShell>
  )
}

function PredictionBlock({ busy, canOpenVisualization, datasets, modeOptions, modelOptions, confidenceOptions, annualHorizonOptions, monthlyHorizonOptions, onChangeDataset, onLoadForecast, onPrev, onSubmit, onUpdate, predictForm, results, selectedDatasetId, selectedDatasetInfo, selectedForecastId, usesMonthlyHorizon, onNext }) {
  return (
    <PanelShell kicker="Previsao" title="Gerar previsao" badge={selectedDatasetInfo ? datasetLabel(selectedDatasetInfo) : "Base necessaria"}>
      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm font-semibold text-[#001b3c]">Base</span>
          <select className={CONTROL_CLASS_NAME} value={selectedDatasetId} onChange={(event) => onChangeDataset(event.target.value, { loadRelatedForecast: false })}>
            <option value="">Selecione uma base</option>
            {datasets.map((item) => (
              <option key={item.dataset_id} value={item.dataset_id}>
                {datasetLabel(item)}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          {modeOptions.length > 1 ? <SelectField label="Saida" icon="swap_horiz" tone="violet" value={predictForm.mode} onChange={(value) => onUpdate("mode", value)} options={modeOptions} /> : <MiniInfo label="Saida" value={selectedDatasetInfo?.frequency === "monthly" ? "Mensal" : "Anual"} />}
          {modelOptions.length > 1 ? <SelectField label="Modelo" icon="neurology" tone="blue" value={predictForm.model} onChange={(value) => onUpdate("model", value)} options={modelOptions} /> : <MiniInfo label="Modelo" value={modelOptions[0]?.label || "ARIMA"} />}
          <SelectField label={usesMonthlyHorizon ? "Meses futuros" : "Anos futuros"} icon="timeline" tone="amber" value={usesMonthlyHorizon ? predictForm.forecast_periods : predictForm.forecast_years} onChange={(value) => onUpdate(usesMonthlyHorizon ? "forecast_periods" : "forecast_years", value)} options={usesMonthlyHorizon ? monthlyHorizonOptions : annualHorizonOptions} />
          <SelectField label="Confianca" icon="verified" tone="emerald" value={predictForm.confidence} onChange={(value) => onUpdate("confidence", value)} options={confidenceOptions} />
        </div>

        <p className="text-sm text-on-surface-variant">A previsao usa automaticamente a UF da base importada.</p>

        <button type="submit" disabled={!selectedDatasetId || busy.predict || busy.dataset} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#001b3c] to-[#0f6db5] px-5 py-4 font-bold text-white transition hover:from-primary hover:to-[#1784d5] disabled:cursor-not-allowed disabled:opacity-60">
          <span className="material-symbols-outlined">insights</span>
          {busy.predict ? "Processando..." : "Gerar previsao"}
        </button>

        {results.length ? (
          <label className="block">
            <span className="text-sm font-semibold text-[#001b3c]">Previsao salva</span>
            <select className={CONTROL_CLASS_NAME} value={selectedForecastId} onChange={(event) => onLoadForecast(event.target.value, BLOCKS.prediction)}>
              <option value="">Selecione</option>
              {results.map((item) => (
                <option key={item.forecast_id} value={item.forecast_id}>
                  {forecastLabel(item)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </form>

      <BlockFooter previousLabel="Voltar" onPrevious={onPrev} nextLabel="Visualizar" nextDisabled={!canOpenVisualization} onNext={onNext} />
    </PanelShell>
  )
}

function VisualizationBlock({ busy, chartRef, forecastRows, onExportJson, onExportPdf, onLoadForecast, onPrev, periodKey, predictionDetail, results, selectedForecastId }) {
  return (
    <PanelShell kicker="Visualizacao" title="Visualizar resultado" badge={predictionDetail?.result?.model || "Sem previsao"}>
      <div className="space-y-6">
        {results.length ? (
          <label className="block">
            <span className="text-sm font-semibold text-[#001b3c]">Resultado</span>
            <select className={CONTROL_CLASS_NAME} value={selectedForecastId} onChange={(event) => onLoadForecast(event.target.value, BLOCKS.visualization)}>
              <option value="">Selecione</option>
              {results.map((item) => (
                <option key={item.forecast_id} value={item.forecast_id}>
                  {forecastLabel(item)}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div ref={chartRef}>
          <ForecastChart prediction={predictionDetail?.result} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <MiniInfo label="Modelo" value={predictionDetail?.result?.model || "--"} />
          <MiniInfo label="Ultimo observado" value={formatNumber(predictionDetail?.result?.last_observed)} />
          <MiniInfo label="Pico observado" value={formatNumber(predictionDetail?.result?.peak_observed)} />
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={onExportJson} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 font-semibold text-[#001b3c] transition hover:border-primary hover:text-primary">
            <span className="material-symbols-outlined">data_object</span>
            Exportar JSON
          </button>
          <button type="button" onClick={onExportPdf} disabled={busy.download} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 font-semibold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60">
            <span className="material-symbols-outlined">picture_as_pdf</span>
            {busy.download ? "Gerando..." : "Exportar PDF"}
          </button>
        </div>

        <div className="overflow-x-auto rounded-[24px] border border-slate-200">
          {forecastRows.length ? (
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-surface-container-low">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-[#001b3c]">Periodo</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#001b3c]">Valor</th>
                  <th className="px-4 py-3 text-left font-semibold text-[#001b3c]">Faixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {forecastRows.map((row) => (
                  <tr key={String(row[periodKey])}>
                    <td className="px-4 py-3 text-on-surface-variant">{row[periodKey]}</td>
                    <td className="px-4 py-3 font-semibold text-[#001b3c]">{formatNumber(row.value)}</td>
                    <td className="px-4 py-3 text-on-surface-variant">{`${formatNumber(row.lower)} a ${formatNumber(row.upper)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-6 text-sm text-on-surface-variant">Nenhum resultado carregado.</div>
          )}
        </div>
      </div>

      <BlockFooter previousLabel="Voltar" onPrevious={onPrev} nextLabel="Manter neste bloco" nextDisabled />
    </PanelShell>
  )
}

function QuickChart({ activeBlock, onLoadForecast, onOpenVisualization, predictionDetail, results, selectedDatasetInfo, selectedForecastId }) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Leitura rapida</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            {selectedDatasetInfo ? `${datasetLabel(selectedDatasetInfo)} | ${predictionDetail.result.model}` : predictionDetail.result.model}
          </p>
        </div>
        <button type="button" onClick={onOpenVisualization} className="rounded-2xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-container">
          Abrir visualizacao
        </button>
      </div>

      {results.length > 1 ? (
        <label className="mt-4 block">
          <span className="text-sm font-semibold text-[#001b3c]">Outro resultado</span>
          <select className={CONTROL_CLASS_NAME} value={selectedForecastId} onChange={(event) => onLoadForecast(event.target.value, activeBlock, true)}>
            <option value="">Selecione</option>
            {results.map((item) => (
              <option key={item.forecast_id} value={item.forecast_id}>
                {forecastLabel(item)}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-5">
        <ForecastChart prediction={predictionDetail.result} />
      </div>
    </section>
  )
}

function datasetLabel(item) {
  return item.display_name || item.file_name
}

function forecastLabel(item) {
  return `${formatDate(item.saved_at)} | ${item.model}`
}

function MiniInfo({ label, value }) {
  return (
    <article className="rounded-[22px] border border-[#d7e7f6] bg-gradient-to-br from-[#f6fbff] to-[#edf5ff] px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#0b4c8a]">{label}</p>
      <p className="mt-2 text-base font-bold text-[#001b3c]">{value}</p>
    </article>
  )
}

export default DiseaseDetail
