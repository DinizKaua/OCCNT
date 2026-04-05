import { Link } from "react-router-dom"

import Footer from "../components/Footer"
import Navbar from "../components/Navbar"

function PlaceholderPage({ eyebrow, title, description }) {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />

      <main className="pb-24">
        <section className="bg-gradient-to-br from-primary via-[#003d78] to-[#78add9] text-white">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <p className="text-xs font-bold uppercase tracking-[0.32em] text-cyan-100">{eyebrow}</p>
            <h1 className="mt-4 text-4xl font-black md:text-6xl">{title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-blue-50/90">{description}</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link to="/" className="rounded-2xl bg-white px-6 py-3 font-bold text-primary transition hover:bg-blue-50">
                Voltar para a home
              </Link>
              <Link to="/doencas/hipertensao" className="rounded-2xl border border-white/20 px-6 py-3 font-bold text-white transition hover:bg-white/10">
                Abrir uma pagina de doenca
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="grid gap-6 lg:grid-cols-3">
            <InfoCard
              icon="motion_photos_auto"
              title="Fluxo de placeholder"
              text="Este espaço existe para manter todos os botoes e links do site navegaveis durante o desenvolvimento."
            />
            <InfoCard
              icon="public"
              title="Navegacao local"
              text="Os links permanecem dentro do proprio localhost para simular cliques, retorno e continuidade visual."
            />
            <InfoCard
              icon="dns"
              title="Fluxo local"
              text="Esta area continua dentro do localhost apenas para manter a navegacao consistente durante o desenvolvimento."
            />
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}

function InfoCard({ icon, title, text }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <span className="material-symbols-outlined text-4xl text-primary">{icon}</span>
      <h2 className="mt-4 text-xl font-bold text-[#001b3c]">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{text}</p>
    </article>
  )
}

export default PlaceholderPage
