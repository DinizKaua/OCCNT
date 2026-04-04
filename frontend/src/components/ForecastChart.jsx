function ForecastChart({ prediction }) {
  if (!prediction || !prediction.historical_data?.length) {
    return (
      <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-slate-300">
        <p className="text-base font-semibold text-white">Sem previsao</p>
        <p className="mt-2 text-sm text-slate-400">Gere uma previsao para visualizar o grafico.</p>
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

  const historyRange = buildRangeLabel(historical, timeKey)
  const forecastRange = buildRangeLabel(forecast, timeKey)
  const historyColor = "#7dd3fc"
  const forecastColor = "#6ee7b7"

  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-200">Historico e previsao</p>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{prediction.model}</span>
      </div>

      <div className="mt-6 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[720px] w-full">
          <defs>
            <linearGradient id="forecastFill" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(110, 231, 183, 0.32)" />
              <stop offset="100%" stopColor="rgba(110, 231, 183, 0.02)" />
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
            stroke={historyColor}
            strokeWidth="4"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={historicalPoints}
          />

          {forecast.length > 0 ? (
            <polyline
              fill="none"
              stroke={forecastColor}
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
              fill={historyColor}
            />
          ))}

          {forecast.map((item, index) => (
            <circle
              key={`forecast-${item[timeKey]}`}
              cx={xForIndex(historical.length + index, labels.length)}
              cy={yForValue(Number(item.value))}
              r="4.5"
              fill={forecastColor}
            />
          ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <RangeCard label="Dados" range={historyRange} accentClass="border-sky-400/30 bg-sky-400/10 text-sky-200" />
        <RangeCard label="Previsao" range={forecastRange} accentClass="border-emerald-400/30 bg-emerald-400/10 text-emerald-200" />
      </div>
    </div>
  )
}

function RangeCard({ label, range, accentClass }) {
  return (
    <div className={`rounded-2xl border px-4 py-3 ${accentClass}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.24em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{range}</p>
    </div>
  )
}

function buildRangeLabel(items, timeKey) {
  if (!items?.length) {
    return "--"
  }

  const first = String(items[0][timeKey])
  const last = String(items[items.length - 1][timeKey])
  return first === last ? first : `${first} - ${last}`
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("pt-BR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)
}

export default ForecastChart
