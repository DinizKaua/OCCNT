import { Link } from "react-router-dom"

function Card({ icon, title, trend, trendType, to }) {
  const content = (
    <>
      <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-lg text-primary transition-transform group-hover:scale-120">
        <span className="material-symbols-outlined text-5xl">{icon}</span>
      </div>

      <h3 className="mb-2 text-xl font-bold text-on-surface">{title}</h3>

      <div
        className={`mb-6 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold
        ${trendType === "up" ? "bg-red-100 text-red-600" : ""}
        ${trendType === "down" ? "bg-blue-100 text-blue-600" : ""}
        ${trendType === "neutral" ? "bg-gray-100 text-gray-600" : ""}
      `}
      >
        <span className="material-symbols-outlined text-xs">
          {trendType === "up" ? "trending_up" : trendType === "down" ? "trending_down" : "trending_flat"}
        </span>
        {trend}
      </div>

      <span className="inline-flex w-full items-center justify-center rounded-lg border border-outline/20 py-3 text-sm font-bold transition-all hover:bg-primary hover:text-white">
        Ver Detalhes
      </span>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="group block rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 transition-all duration-300 hover:shadow-xl"
      >
        {content}
      </Link>
    )
  }

  return (
    <div className="group rounded-xl border border-outline-variant/10 bg-surface-container-low p-6 transition-all duration-300 hover:shadow-xl">
      {content}
    </div>
  )
}

export default Card
