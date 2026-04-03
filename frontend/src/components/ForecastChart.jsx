function ForecastChart({ prediction }) {
  if (!prediction || !prediction.historical_data?.length) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-slate-950 p-6 text-slate-300">
        <p className="text-lg font-semibold text-white">Sem previsao carregada</p>
        <p className="mt-2 text-sm text-slate-400">
          Gere uma previsao automatica pelo bloco DATASUS ou ajuste os parametros no painel personalizado.
        </p>
      </div>
    )
  }

  const historical = prediction.historical_data
  const forecast = prediction.forecast ?? []
  const timeKey = prediction.output_frequency === "monthly" ? "month" : "year"
  const labels = [...historical, ...forecast].map((item) => String(item[timeKey]))
  const values = [
    ...historical.map((item) => Number(item.value)),
    ...forecast.flatMap((item) => [Number(item.value), Number(item.lower ?? item.value), Number(item.upper ?? item.value)]),
  ]

  const width = 760
  const height = 300
  const paddingX = 42
  const paddingTop = 20
  const paddingBottom = 38
  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const paddedMin = Math.max(0, minValue - (maxValue - minValue || 1) * 0.12)
  const paddedMax = maxValue + (maxValue - minValue || 1) * 0.16
  const chartWidth = width - paddingX * 2
  const chartHeight = height - paddingTop - paddingBottom

  const xForIndex = (index, total) => {
    if (total <= 1) {
      return width / 2
    }
    return paddingX + (index / (total - 1)) * chartWidth
  }

  const yForValue = (value) => {
    const safeRange = paddedMax - paddedMin || 1
    return paddingTop + ((paddedMax - value) / safeRange) * chartHeight
  }

  const historicalPoints = historical
    .map((item, index) => `${xForIndex(index, labels.length)},${yForValue(Number(item.value))}`)
    .join(" ")

  const forecastLinePoints = [historical[historical.length - 1], ...forecast]
    .map((item, index) => {
      const pointIndex = historical.length - 1 + index
      return `${xForIndex(pointIndex, labels.length)},${yForValue(Number(item.value))}`
    })
    .join(" ")

  const areaPoints =
    forecast.length > 0
      ? [
          ...forecast.map(
            (item, index) =>
              `${xForIndex(historical.length + index, labels.length)},${yForValue(Number(item.upper ?? item.value))}`
          ),
          ...[...forecast]
            .reverse()
            .map((item, reverseIndex) => {
              const index = forecast.length - 1 - reverseIndex
              return `${xForIndex(historical.length + index, labels.length)},${yForValue(Number(item.lower ?? item.value))}`
            }),
        ].join(" ")
      : ""

  const axisValues = Array.from({ length: 4 }, (_, index) => {
    const ratio = index / 3
    const value = paddedMax - (paddedMax - paddedMin) * ratio
    return {
      value,
      y: yForValue(value),
    }
  })

  const previewLabels = [labels[0], labels[Math.floor(labels.length / 2)], labels[labels.length - 1]].filter(Boolean)

  return (
    <div className="rounded-[28px] border border-white/10 bg-slate-950 p-6 text-white shadow-2xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">Serie temporal</p>
          <h3 className="mt-2 text-2xl font-bold">Historico e previsao conectados</h3>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-cyan-300"></span>
            Historico
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-300"></span>
            Previsao
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-white/40"></span>
            Intervalo
          </span>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] w-full">
          <defs>
            <linearGradient id="forecastFill" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(103, 232, 249, 0.32)" />
              <stop offset="100%" stopColor="rgba(103, 232, 249, 0.02)" />
            </linearGradient>
            <linearGradient id="forecastLine" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#6ee7b7" />
            </linearGradient>
          </defs>

          {axisValues.map((axis) => (
            <g key={axis.y}>
              <line
                x1={paddingX}
                x2={width - paddingX}
                y1={axis.y}
                y2={axis.y}
                stroke="rgba(255,255,255,0.10)"
                strokeDasharray="4 6"
              />
              <text x={8} y={axis.y + 4} fill="rgba(255,255,255,0.55)" fontSize="11">
                {formatCompactNumber(axis.value)}
              </text>
            </g>
          ))}

          {areaPoints ? <polygon points={areaPoints} fill="url(#forecastFill)" /> : null}

          <polyline
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={historicalPoints}
          />

          {forecast.length > 0 ? (
            <polyline
              fill="none"
              stroke="url(#forecastLine)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={forecastLinePoints}
            />
          ) : null}

          {historical.map((item, index) => (
            <circle
              key={`historical-${item[timeKey]}`}
              cx={xForIndex(index, labels.length)}
              cy={yForValue(Number(item.value))}
              r="4.5"
              fill="#7dd3fc"
            />
          ))}

          {forecast.map((item, index) => (
            <circle
              key={`forecast-${item[timeKey]}`}
              cx={xForIndex(historical.length + index, labels.length)}
              cy={yForValue(Number(item.value))}
              r="4.5"
              fill="#6ee7b7"
            />
          ))}
        </svg>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <div className="flex flex-wrap gap-3">
          {previewLabels.map((label) => (
            <span key={label} className="rounded-full border border-white/10 px-3 py-1">
              {label}
            </span>
          ))}
        </div>
        <p>
          Modelo ativo: <span className="font-semibold text-white">{prediction.model}</span>
        </p>
      </div>
    </div>
  )
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export default ForecastChart
