import { Link } from "react-router-dom"

function Card({
  icon,
  title,
  trend,
  trendType,
  to,
  onClick,
  layout = "vertical",
  showIcon = true,
  showButton = true,
  description,
}) {
  const isHorizontal = layout === "horizontal"
  const interactive = Boolean(to || onClick)

  const wrapperClassName = `group rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 transition-all duration-300 hover:shadow-xl ${interactive ? "cursor-pointer" : ""} ${isHorizontal ? "flex items-center justify-between gap-6" : ""}`

  const content = isHorizontal ? (
    <>
      <div className="flex items-center gap-6">
        {showIcon ? (
          <span className="material-symbols-outlined text-5xl text-primary transition-transform group-hover:scale-120">
            {icon}
          </span>
        ) : null}

        <div>
          <h3 className="mb-1 text-xl font-bold text-on-surface">{title}</h3>

          {description ? (
            <p className="text-sm text-on-surface-variant">{description}</p>
          ) : null}

          <TrendBadge trend={trend} trendType={trendType} className="mt-2" />
        </div>
      </div>

      {showButton ? (
        <ActionButton onClick={onClick} block={false}>
          Ver Detalhes
        </ActionButton>
      ) : null}
    </>
  ) : (
    <>
      {showIcon ? (
        <div className="mb-6 flex h-12 w-12 items-center justify-center text-primary transition-transform group-hover:scale-120">
          <span className="material-symbols-outlined text-5xl">{icon}</span>
        </div>
      ) : null}

      <h3 className="mb-2 text-xl font-bold text-on-surface">{title}</h3>

      {description ? (
        <p className="mb-2 text-sm text-on-surface-variant">{description}</p>
      ) : null}

      <TrendBadge trend={trend} trendType={trendType} className="mb-4" />

      {showButton ? (
        to ? (
          <span className="inline-flex w-full items-center justify-center rounded-lg border border-outline/20 py-3 text-sm font-bold transition-all hover:bg-primary hover:text-white">
            Ver Detalhes
          </span>
        ) : (
          <ActionButton onClick={onClick} block>
            Ver Detalhes
          </ActionButton>
        )
      ) : null}
    </>
  )

  if (to) {
    return (
      <Link to={to} className={wrapperClassName}>
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            onClick()
          }
        }}
        className={wrapperClassName}
      >
        {content}
      </div>
    )
  }

  return <div className={wrapperClassName}>{content}</div>
}

function TrendBadge({ trend, trendType, className = "" }) {
  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold
      ${trendType === "up" ? "bg-red-100 text-red-600" : ""}
      ${trendType === "down" ? "bg-blue-100 text-blue-600" : ""}
      ${trendType === "neutral" ? "bg-gray-100 text-gray-600" : ""}
      ${className}`}
    >
      <span className="material-symbols-outlined text-xs">
        {trendType === "up" ? "trending_up" : trendType === "down" ? "trending_down" : "trending_flat"}
      </span>
      {trend}
    </div>
  )
}

function ActionButton({ children, onClick, block }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onClick?.()
      }}
      className={`${block ? "w-full" : "px-6"} rounded-lg border border-outline/20 py-3 text-sm font-bold transition-all hover:bg-primary hover:text-white`}
    >
      {children}
    </button>
  )
}

export default Card
