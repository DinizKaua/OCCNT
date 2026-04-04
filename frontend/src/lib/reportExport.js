import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export async function exportVisualizationPdf({
  chartElement,
  disease,
  dataset,
  predictionDetail,
}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const rows = buildVisualizationRows(predictionDetail?.result)
  const chartImage = chartElement ? await captureChart(chartElement) : null
  const fileStamp = buildShortStamp()

  doc.setFillColor(0, 27, 60)
  doc.rect(0, 0, 210, 32, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(10)
  doc.text("Observatorio DCNT", 14, 10)
  doc.setFontSize(20)
  doc.text(disease.title, 14, 19)
  doc.setFontSize(10)
  doc.text(`CID ${disease.cidLabel}`, 14, 26)

  doc.setTextColor(20, 34, 56)
  doc.setFontSize(11)
  doc.text(`Dataset ativo: ${dataset?.display_name || dataset?.file_name || "Nao informado"}`, 14, 42)
  doc.text(`Modelo: ${predictionDetail?.result?.model || "--"}`, 14, 49)
  doc.text(`Ultima previsao salva: ${formatDate(predictionDetail?.saved_at)}`, 14, 56)

  if (chartImage) {
    doc.addImage(chartImage, "PNG", 14, 63, 182, 68)
  }

  autoTable(doc, {
    startY: chartImage ? 138 : 66,
    head: [["Indicador", "Valor"]],
    body: [
      ["Ultimo observado", formatNumber(predictionDetail?.result?.last_observed)],
      ["Pico observado", formatNumber(predictionDetail?.result?.peak_observed)],
      ["Pontos historicos", String(predictionDetail?.result?.historical_points ?? 0)],
      ["Pontos previstos", String(predictionDetail?.result?.forecast_points ?? 0)],
      ["Frequencia de saida", predictionDetail?.result?.output_frequency || "--"],
      ["Estado", predictionDetail?.result?.state_label || "--"],
    ],
    styles: {
      fontSize: 9,
      cellPadding: 2.8,
    },
    headStyles: {
      fillColor: [0, 69, 135],
    },
  })

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 8,
    head: [["Periodo", "Tipo", "Valor", "Limite inferior", "Limite superior"]],
    body: rows.map((item) => [
      item.label,
      item.kind,
      formatNumber(item.value),
      item.lower === null ? "--" : formatNumber(item.lower),
      item.upper === null ? "--" : formatNumber(item.upper),
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 2.2,
    },
    headStyles: {
      fillColor: [15, 118, 110],
    },
    margin: { left: 14, right: 14 },
  })

  doc.save(`rel_${disease.slug}_${fileStamp}.pdf`)
}

export function exportVisualizationJson({
  disease,
  dataset,
  predictionDetail,
}) {
  const payload = {
    exported_at: new Date().toISOString(),
    disease: {
      slug: disease.slug,
      title: disease.title,
      cid_label: disease.cidLabel,
    },
    dataset,
    request: predictionDetail?.request ?? null,
    result: predictionDetail?.result ?? null,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `prev_${disease.slug}_${buildShortStamp()}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function buildVisualizationRows(prediction) {
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

async function captureChart(chartElement) {
  const svg = chartElement.querySelector("svg")
  if (!svg) {
    return null
  }

  const serialized = new XMLSerializer().serializeToString(svg)
  const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" })
  const blobUrl = URL.createObjectURL(svgBlob)

  try {
    const image = await loadImage(blobUrl)
    const canvas = document.createElement("canvas")
    canvas.width = image.width || 1200
    canvas.height = image.height || 600
    const context = canvas.getContext("2d")

    if (!context) {
      return null
    }

    context.fillStyle = "#020617"
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/png")
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function formatNumber(value) {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return "--"
  }

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function formatDate(value) {
  if (!value) {
    return "--"
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("pt-BR")
}

function buildShortStamp() {
  return new Date().toISOString().replace(/\D/g, "").slice(0, 14)
}
