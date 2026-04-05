import { Link } from "react-router-dom"

const resourceLinks = [
  { label: "DATASUS", to: "/informacoes" },
  { label: "Portal Gov.br", to: "/repositorio" },
  { label: "Open Data", to: "/informacoes" },
]

const institutionalLinks = [
  { label: "Privacidade", to: "/privacidade" },
  { label: "Termos de Uso", to: "/termos" },
  { label: "Contato", to: "/contato" },
]

// Site footer showing data source metrics, quick resource links and institutional navigation.
function Footer() {
  return (
    <footer>
      <section className="bg-primary py-12 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-8 px-20">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-4xl opacity-60">verified_user</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Fonte de Dados</p>
              <p className="text-lg font-bold">DATASUS - Ministerio da Saude</p>
            </div>
          </div>
          <div className="flex gap-12 text-center">
            <div>
              <p className="text-4xl font-black">0+</p>
              <p className="mt-1 text-xs opacity-60">Registros analisados</p>
            </div>
            <div>
              <p className="text-4xl font-black">0+</p>
              <p className="mt-1 text-xs opacity-60">Municipios cobertos</p>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f0f2f5] py-12">
        <div className="mx-auto max-w-7xl px-8">
          <div className="flex flex-wrap justify-between gap-12">
            <div className="max-w-xs">
              <h3 className="mb-3 text-base font-bold text-[#1a2e4a]">Observatorio DCNT</h3>
              <p className="mb-4 text-sm leading-relaxed text-[#6b7a99]">
                Painel demonstrativo para monitoramento continuo de condicoes cronicas no Brasil, unindo frontend React,
                importacao orientada a dados e previsoes visualmente guiadas.
              </p>
            </div>

            <div>
              <h3 className="mb-4 text-base font-bold text-[#1a2e4a]">Recursos</h3>
              <ul className="space-y-3">
                {resourceLinks.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-sm text-[#6b7a99] transition-colors hover:text-[#1a2e4a]">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 text-base font-bold text-[#1a2e4a]">Institucional</h3>
              <ul className="space-y-3">
                {institutionalLinks.map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="text-sm text-[#6b7a99] transition-colors hover:text-[#1a2e4a]">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-[#dde1ea] bg-[#f0f2f5] py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-8">
          <p className="text-sm text-[#6b7a99]">© 2026 Observatorio DCNT - Ministerio da Saude</p>
          <div className="flex items-center gap-4">
            <Link to="/informacoes" className="material-symbols-outlined text-xl text-[#6b7a99] transition-colors hover:text-[#1a2e4a]">
              language
            </Link>
            <Link to="/repositorio" className="material-symbols-outlined text-xl text-[#6b7a99] transition-colors hover:text-[#1a2e4a]">
              share
            </Link>
            <Link to="/sobre" className="material-symbols-outlined text-xl text-[#6b7a99] transition-colors hover:text-[#1a2e4a]">
              info
            </Link>
          </div>
        </div>
      </section>
    </footer>
  )
}

export default Footer
