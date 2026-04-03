function Card({ icon, title, trend, trendType }) {
  return (
    <div className="group p-6 rounded-xl border border-outline-variant/10 bg-surface-container-low hover:shadow-xl transition-all duration-300">

      {/* ícone */}
      <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-6 text-primary group-hover:scale-120 transition-transform">
        <span className="material-symbols-outlined text-5xl">{icon}</span>
      </div>

      {/* título */}
      <h3 className="text-xl font-bold text-on-surface mb-2">
        {title}
      </h3>

      {/* tendência */}
      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold mb-6
        ${trendType === "up" ? "bg-red-100 text-red-600" : ""}
        ${trendType === "down" ? "bg-blue-100 text-blue-600" : ""}
        ${trendType === "neutral" ? "bg-gray-100 text-gray-600" : ""}
      `}>
        <span className="material-symbols-outlined text-xs">
          {trendType === "up" ? "trending_up" : trendType === "down" ? "trending_down" : "trending_flat"}
        </span>
        {trend}
      </div>

      {/* botão */}
      <button className="w-full py-3 border border-outline/20 rounded-lg text-sm font-bold hover:bg-primary hover:text-white transition-all">
        Ver Detalhes
      </button>

    </div>
  )
}

export default Card