import { Link } from "react-router-dom"

// Reusable card component that supports vertical, horizontal and highlight layouts
// and can render as a link or clickable element.
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
  buttonLabel = "Ver Detalhes",
  indicatorLabel = "Indicador",
}) {
  const isHorizontal = layout === "horizontal"
  const isHighlight = layout === "highlight"
  const interactive = Boolean(to || onClick)

  // ========================
  // BASE WRAPPER
  // ========================
  const baseClass = `
    group rounded-xl border border-outline-variant/10 
    bg-surface-container-low 
    transition-all duration-300 hover:shadow-xl
    ${interactive ? "cursor-pointer" : ""}
  `

  // ========================
  // HORIZONTAL
  // ========================
  if (isHorizontal) {
    const content = (
      <div className="flex items-center justify-between gap-6 p-6 h-full">
        <div className="flex items-center gap-6">
          {showIcon && (
            <span className="material-symbols-outlined text-5xl text-primary transition-transform group-hover:scale-110">
              {icon}
            </span>
          )}

          <div>
            <h3 className="mb-1 text-xl font-bold text-on-surface">
              {title}
            </h3>

            {description && (
              <p className="text-sm text-on-surface-variant">
                {description}
              </p>
            )}

            <TrendBadge trend={trend} trendType={trendType} className="mt-2" />
          </div>
        </div>

        {showButton && (
          to ? (
            <div className="whitespace-nowrap px-4 py-3 rounded-lg border border-outline/20 text-sm font-bold hover:bg-primary hover:text-white transition-all">
              {buttonLabel}
            </div>
          ) : (
            <ActionButton onClick={onClick}>
              {buttonLabel}
            </ActionButton>
          )
        )}
      </div>
    )

    return wrap({ to, onClick, className: baseClass, content })
  }

  // ========================
  // HIGHLIGHT (Diabetes / Obesidade)
  // ========================
  if (isHighlight) {
    const highlightClass = `
      group rounded-2xl border border-outline-variant/10 
      bg-gradient-to-br from-surface-container-low to-surface-container-high
      p-8 h-full flex flex-col justify-between
      transition-all duration-300 hover:shadow-xl
      ${interactive ? "cursor-pointer" : ""}
    `

    const content = (
      <>
        <div>
          <div className="flex items-center gap-4 mb-6">
            {showIcon && (
              <div className="p-3 rounded-xl text-primary">
                <span className="material-symbols-outlined text-5xl text-primary transition-transform group-hover:scale-110">
                  {icon}
                </span>
              </div>
            )}

            <h2 className="text-2xl font-bold text-on-surface">
              {title}
            </h2>
          </div>

          {description && (
            <p className="text-on-surface-variant mb-6">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between p-4 rounded-xl border border-outline/20 mb-6 bg-white/40">
            <span className="font-medium">
              {indicatorLabel}
            </span>

            <TrendBadge trend={trend} trendType={trendType} />
          </div>
        </div>

        {showButton && (
          to ? (
            <div className="w-full flex items-center justify-center py-3 rounded-lg border border-outline/20 text-sm font-bold hover:bg-primary hover:text-white transition-all">
              {buttonLabel}
            </div>
          ) : (
            <ActionButton onClick={onClick} block>
              {buttonLabel}
            </ActionButton>
          )
        )}
      </>
    )

    return wrap({ to, onClick, className: highlightClass, content })
  }

  // ========================
  // VERTICAL (padrão)
  // ========================
  const content = (
    <div className="p-6 h-full flex flex-col justify-between">
      <div>
        {showIcon && (
          <div className="mb-6 text-primary transition-transform group-hover:scale-110">
            <span className="material-symbols-outlined text-5xl">
              {icon}
            </span>
          </div>
        )}

        <h3 className="mb-2 text-xl font-bold text-on-surface">
          {title}
        </h3>

        {description && (
          <p className="mb-2 text-sm text-on-surface-variant">
            {description}
          </p>
        )}

        <TrendBadge trend={trend} trendType={trendType} className="mb-4" />
      </div>

      {showButton && (
        to ? (
          <div className="w-full flex items-center justify-center py-3 rounded-lg border border-outline/20 text-sm font-bold hover:bg-primary hover:text-white transition-all">
            {buttonLabel}
          </div>
        ) : (
          <ActionButton onClick={onClick} block>
            {buttonLabel}
          </ActionButton>
        )
      )}
    </div>
  )

  return wrap({ to, onClick, className: baseClass, content })
}

// ========================
// WRAPPER (Link ou Click)
// ========================
function wrap({ to, onClick, className, content }) {
  if (to) {
    return <Link to={to} className={className}>{content}</Link>
  }

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        }}
        className={className}
      >
        {content}
      </div>
    )
  }

  return <div className={className}>{content}</div>
}

// ========================
// TREND
// ========================
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
        {trendType === "up"
          ? "trending_up"
          : trendType === "down"
          ? "trending_down"
          : "trending_flat"}
      </span>
      {trend}
    </div>
  )
}

// ========================
// BUTTON
// ========================
function ActionButton({ children, onClick, block }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
      className={`${block ? "w-full" : "px-6"} flex items-center justify-center py-3 rounded-lg border border-outline/20 text-sm font-bold transition-all hover:bg-primary hover:text-white`}
    >
      {children}
    </button>
  )
}

export default Card