export const BLOCKS = {
  import: "import",
  prediction: "prediction",
  visualization: "visualization",
}

export const EMPTY_EXPORT_FORM = {
  system: "SIM-DO",
  uf: "MA",
  year_start: new Date().getFullYear() - 7,
  year_end: new Date().getFullYear() - 1,
  granularity: "year",
  month_start: 1,
  month_end: 12,
}

export const EMPTY_PREDICT_FORM = {
  mode: "auto",
  model: "arima",
  forecast_years: 4,
  forecast_periods: 48,
  confidence: 0.95,
}

export function buildExportForm(uiOptions, disease, availability = uiOptions?.initial_availability ?? null) {
  const defaults = uiOptions?.defaults?.export ?? EMPTY_EXPORT_FORM
  const years = getAvailableYearOptions(uiOptions, availability)
  const latestOption = years.at(-1)
  const safeEndYear = years.includes(Number(defaults.year_end)) ? Number(defaults.year_end) : latestOption ?? defaults.year_end
  const safeStartYear = years.includes(Number(defaults.year_start))
    ? Number(defaults.year_start)
    : years.length
      ? Math.max(years[0], safeEndYear - 6)
      : defaults.year_start

  return normalizeExportForm(uiOptions, availability, {
    ...defaults,
    ...(disease?.exportDefaults ?? {}),
    year_start: safeStartYear,
    year_end: safeEndYear,
  })
}

export function buildPredictForm(uiOptions, disease) {
  const defaults = uiOptions?.defaults?.predict ?? EMPTY_PREDICT_FORM
  return {
    mode: defaults.mode ?? EMPTY_PREDICT_FORM.mode,
    model: defaults.model ?? EMPTY_PREDICT_FORM.model,
    forecast_years: Number(defaults.forecast_years ?? EMPTY_PREDICT_FORM.forecast_years),
    forecast_periods: Number(defaults.forecast_periods ?? EMPTY_PREDICT_FORM.forecast_periods),
    confidence: Number(defaults.confidence ?? EMPTY_PREDICT_FORM.confidence),
    ...(disease?.predictDefaults ?? {}),
  }
}

export function buildPredictionPayload(formValues, datasetId, diseaseSlug) {
  return {
    dataset_id: datasetId,
    disease_slug: diseaseSlug,
    mode: formValues.mode,
    model: formValues.model,
    forecast_years: Number(formValues.forecast_years),
    forecast_periods: Number(formValues.forecast_periods),
    confidence: Number(formValues.confidence),
  }
}

export function buildDatasetName(disease, exportForm) {
  return `${disease.slug}_${String(exportForm.uf).toLowerCase()}_${buildShortStamp()}`
}

export function applySavedRequest(current, request) {
  return {
    ...current,
    mode: request?.mode ?? current.mode,
    model: request?.model ?? current.model,
    forecast_years: Number(request?.forecast_years ?? current.forecast_years),
    forecast_periods: Number(request?.forecast_periods ?? current.forecast_periods),
    confidence: Number(request?.confidence ?? current.confidence),
  }
}

export function getModeOptions(uiOptions, dataset) {
  const options =
    uiOptions?.mode_options?.map((item) => ({
      value: item.value,
      label: item.label,
    })) ?? []

  if (dataset?.frequency === "annual") {
    return options.filter((item) => item.value !== "monthly")
  }

  return options
}

export function normalizePredictForm(uiOptions, disease, dataset, current = EMPTY_PREDICT_FORM) {
  const defaults = buildPredictForm(uiOptions, disease)
  const allowedModes = getModeOptions(uiOptions, dataset).map((item) => item.value)
  const allowedModels = (uiOptions?.model_options ?? []).map((item) => item.value)

  return {
    ...defaults,
    ...current,
    mode: allowedModes.includes(current.mode) ? current.mode : defaults.mode,
    model: allowedModels.includes(current.model) ? current.model : defaults.model,
    forecast_years: Number(current.forecast_years ?? defaults.forecast_years),
    forecast_periods: Number(current.forecast_periods ?? defaults.forecast_periods),
    confidence: Number(current.confidence ?? defaults.confidence),
  }
}

export function normalizeExportForm(uiOptions, availability, current = EMPTY_EXPORT_FORM, changedField = null) {
  const years = getAvailableYearOptions(uiOptions, availability)
  const next = {
    ...EMPTY_EXPORT_FORM,
    ...current,
  }

  if (years.length) {
    const minYear = years[0]
    const maxYear = years.at(-1)
    next.year_start = clampNumber(next.year_start, minYear, maxYear)
    next.year_end = clampNumber(next.year_end, minYear, maxYear)
    if (next.year_start > next.year_end) {
      if (changedField === "year_end") {
        next.year_start = next.year_end
      } else {
        next.year_end = next.year_start
      }
    }
  }

  const startMonthOptions = getAvailableMonthOptions(uiOptions, availability, next.year_start)
  const endMonthOptions = getAvailableMonthOptions(uiOptions, availability, next.year_end)
  if (startMonthOptions.length) {
    next.month_start = clampToOptions(next.month_start, startMonthOptions)
  }
  if (endMonthOptions.length) {
    next.month_end = clampToOptions(next.month_end, endMonthOptions)
  }
  if (next.year_start === next.year_end && next.month_start > next.month_end) {
    if (changedField === "month_end") {
      next.month_start = next.month_end
    } else {
      next.month_end = next.month_start
    }
  }

  return next
}

export function getAvailableYearOptions(uiOptions, availability) {
  const years = (availability?.year_options ?? uiOptions?.year_options ?? []).map(Number).filter((item) => Number.isFinite(item))
  return years.length ? years : (uiOptions?.year_options ?? []).map(Number).filter((item) => Number.isFinite(item))
}

export function getAvailableMonthOptions(uiOptions, availability, yearValue) {
  const monthMap = availability?.month_map ?? {}
  const yearKey = String(yearValue ?? "")
  const availabilityMonths = (monthMap[yearKey] ?? []).map(Number).filter((item) => Number.isFinite(item))
  if (availabilityMonths.length) {
    return availabilityMonths
  }
  return (uiOptions?.month_options ?? []).map(Number).filter((item) => Number.isFinite(item))
}

export function buildMetrics(prediction, dataset, savedAt) {
  return [
    { label: "Ultimo observado", value: formatNumber(prediction?.last_observed), sub: prediction?.state_label || "Sem serie carregada" },
    { label: "Pico historico", value: formatNumber(prediction?.peak_observed), sub: dataset?.display_name || "Aguardando base" },
    { label: "Pontos previstos", value: String(prediction?.forecast_points ?? 0), sub: prediction?.model || "Sem modelo" },
    { label: "Resultado", value: savedAt ? formatDate(savedAt) : "Atual", sub: dataset?.frequency || "Sem frequencia definida" },
  ]
}

export function buildVisualizationRows(prediction) {
  if (!prediction) {
    return []
  }

  const timeKey = prediction.output_frequency === "monthly" ? "month" : "year"
  const historicalRows = (prediction.historical_data || []).map((item) => ({
    label: String(item[timeKey]),
    kind: "Historico",
    value: Number(item.value),
    lower: null,
    upper: null,
  }))
  const forecastRows = (prediction.forecast || []).map((item) => ({
    label: String(item[timeKey]),
    kind: "Previsao",
    value: Number(item.value),
    lower: Number(item.lower ?? item.value),
    upper: Number(item.upper ?? item.value),
  }))

  return [...historicalRows, ...forecastRows]
}

export function parseField(field, value) {
  if (["year_start", "year_end", "month_start", "month_end", "forecast_years", "forecast_periods"].includes(field)) {
    return Number(value)
  }

  if (field === "confidence") {
    return Number(value)
  }

  return value
}

export function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "--"
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(Number(value))
}

export function formatDate(value) {
  if (!value) {
    return "--"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR")
}

export function formatSize(sizeKb) {
  if (sizeKb === undefined || sizeKb === null || Number.isNaN(Number(sizeKb))) {
    return "--"
  }

  return `${Number(sizeKb).toFixed(1)} KB`
}

export function shortenSession(value) {
  if (!value) {
    return "--"
  }

  return `${value.slice(0, 8)}...`
}

function clampNumber(value, minimum, maximum) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return minimum
  }
  return Math.min(Math.max(numericValue, minimum), maximum)
}

function clampToOptions(value, options) {
  const numericValue = Number(value)
  if (!Number.isFinite(numericValue)) {
    return options[0]
  }
  if (options.includes(numericValue)) {
    return numericValue
  }
  return options.reduce((closest, option) => Math.abs(option - numericValue) < Math.abs(closest - numericValue) ? option : closest, options[0])
}

function buildShortStamp() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14)
}
