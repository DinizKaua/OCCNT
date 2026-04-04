import { Link } from "react-router-dom"

export function Notice({ children, tone }) {
  const tones = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-slate-200 bg-white text-on-surface-variant",
  }

  return <div className={`rounded-[24px] border px-5 py-4 text-sm font-medium shadow-sm ${tones[tone]}`}>{children}</div>
}

export function HeroStat({ label, value, detail }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{label}</p>
      <p className="mt-3 text-3xl font-black text-[#001b3c]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{detail}</p>
    </article>
  )
}

export function StepCard({ number, title, text, active, available, onClick }) {
  return (
    <button
      type="button"
      onClick={available ? onClick : undefined}
      className={`rounded-[28px] border p-5 text-left transition ${
        active
          ? "border-primary bg-primary/5 shadow-sm"
          : available
            ? "border-slate-200 bg-white hover:border-primary/40"
            : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-black text-primary">{number}</span>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${available ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
          {available ? "Liberado" : "Bloqueado"}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-bold text-[#001b3c]">{title}</h3>
      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{text}</p>
    </button>
  )
}

export function PanelShell({ kicker, title, badge, children }) {
  return (
    <section className="rounded-[32px] border border-[#d6e5f5] bg-gradient-to-br from-white via-white to-[#f4faff] p-7 shadow-sm shadow-slate-200/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.26em] text-primary">{kicker}</p>
          <h2 className="mt-2 text-2xl font-extrabold text-[#001b3c]">{title}</h2>
          <span className="mt-3 block h-1.5 w-20 rounded-full bg-gradient-to-r from-[#0b4c8a] via-[#3e8ed0] to-[#8fd3ff]"></span>
        </div>
        <span className="rounded-full border border-[#cfe1f5] bg-[#eef6ff] px-4 py-2 text-xs font-bold text-[#0b4c8a]">{badge}</span>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function SelectField({ label, value, onChange, options, helper, icon = "tune", tone = "blue" }) {
  const hasOptions = options.length > 0
  const safeOptions = hasOptions ? options : [{ value: value ?? "", label: "Carregando opcoes..." }]
  const toneClasses = {
    blue: {
      label: "text-[#0b3d74]",
      shell: "border-[#cfe1f5] bg-[#f7fbff] focus-within:border-primary focus-within:ring-primary/10",
      icon: "text-[#0b4c8a]",
    },
    amber: {
      label: "text-[#9a5b00]",
      shell: "border-[#f0d9a6] bg-[#fffaf0] focus-within:border-[#d18b00] focus-within:ring-[#d18b00]/10",
      icon: "text-[#c57d00]",
    },
    emerald: {
      label: "text-[#0b6b52]",
      shell: "border-[#ccecdf] bg-[#f5fffb] focus-within:border-[#0e8a69] focus-within:ring-[#0e8a69]/10",
      icon: "text-[#0e8a69]",
    },
    violet: {
      label: "text-[#5a4ab6]",
      shell: "border-[#ddd8ff] bg-[#f8f7ff] focus-within:border-[#6d5ce7] focus-within:ring-[#6d5ce7]/10",
      icon: "text-[#6d5ce7]",
    },
  }
  const currentTone = toneClasses[tone] ?? toneClasses.blue

  return (
    <label className="block">
      <span className={`text-sm font-semibold ${currentTone.label}`}>{label}</span>
      <div className={`mt-3 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-sm transition focus-within:ring-4 ${currentTone.shell}`}>
        <span className={`material-symbols-outlined text-[20px] ${currentTone.icon}`}>{icon}</span>
        <select
          disabled={!hasOptions}
          className="w-full appearance-none bg-transparent pr-4 text-sm font-medium text-[#0b2545] outline-none disabled:cursor-not-allowed"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {safeOptions.map((option) => (
            <option key={`${label}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="material-symbols-outlined text-[20px] text-slate-400">expand_more</span>
      </div>
      {helper ? <p className="mt-2 text-xs leading-6 text-on-surface-variant">{helper}</p> : null}
    </label>
  )
}

export function LockedField({ label, value, helper }) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-surface-container-low p-4">
      <p className="text-sm font-semibold text-[#001b3c]">{label}</p>
      <p className="mt-2 text-base font-bold text-primary">{value}</p>
      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{helper}</p>
    </div>
  )
}

export function DataCard({ title, value, description }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-surface-container-low p-5">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{title}</p>
      <p className="mt-3 text-xl font-bold text-[#001b3c]">{value}</p>
      <p className="mt-2 text-sm leading-7 text-on-surface-variant">{description}</p>
    </article>
  )
}

export function HistoryPanel({ title, empty, items, renderItem }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-surface-container-low p-5">
      <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{title}</p>
      <div className="mt-4 space-y-3">{items.length ? items.map(renderItem) : <p className="text-sm text-on-surface-variant">{empty}</p>}</div>
    </div>
  )
}

export function PreviewCard({ preview }) {
  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">Preview da base</p>
          <h3 className="mt-2 text-xl font-bold text-[#001b3c]">Amostra do dataset salvo para esta doenca</h3>
        </div>
        <span className="rounded-full bg-surface-container-low px-4 py-2 text-xs font-bold text-slate-700">
          {preview?.rows?.length ?? 0} linha(s)
        </span>
      </div>

      <div className="mt-5 overflow-x-auto rounded-[24px] border border-slate-200">
        {preview?.columns?.length ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-surface-container-low">
              <tr>
                {preview.columns.map((column) => (
                  <th key={column} className="px-4 py-3 text-left font-semibold text-[#001b3c]">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {preview.rows.map((row, rowIndex) => (
                <tr key={`${rowIndex}-${row.join("-")}`}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`} className="px-4 py-3 text-on-surface-variant">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8">
            <p className="font-semibold text-[#001b3c]">Nenhum preview disponivel.</p>
            <p className="mt-2 text-sm text-on-surface-variant">Assim que uma base for ativada, mostramos aqui uma amostra dos dados processados.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export function MetricMini({ label, value, icon }) {
  return (
    <article className="rounded-[24px] border border-slate-200 bg-surface-container-low p-4">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-primary">{icon}</span>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-primary">{label}</p>
          <p className="mt-1 font-semibold text-[#001b3c]">{value}</p>
        </div>
      </div>
    </article>
  )
}

export function BlockFooter({ previousLabel, previousTo, onPrevious, nextLabel, onNext, nextDisabled }) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-6">
      {previousTo ? (
        <Link to={previousTo} className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-[#001b3c] transition hover:border-primary hover:text-primary">
          {previousLabel}
        </Link>
      ) : (
        <button type="button" onClick={onPrevious} className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-[#001b3c] transition hover:border-primary hover:text-primary">
          {previousLabel}
        </button>
      )}

      <button type="button" onClick={nextDisabled ? undefined : onNext} disabled={nextDisabled} className="rounded-2xl bg-primary px-5 py-3 font-semibold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60">
        {nextLabel}
      </button>
    </div>
  )
}
