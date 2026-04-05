import { Link } from "react-router-dom"

import brazil from "../assets/brazil.svg"


import Footer from "../components/Footer"
import Navbar from "../components/Navbar"
import Circulatorio from "../sections/Circulatorio"
import Neoplasias from "../sections/Neoplasias"
import Respiratorias from "../sections/Respiratorias"
import Metabolicas from "../sections/Metabolicas"

function Home() {
  return (
    <div className="min-h-screen bg-background text-on-surface">
      <Navbar />

      {/* Página inicial com banner, chamadas para ação e seções de doenças */}
      <main className="pb-20">
        <section className="relative flex min-h-[614px] items-center overflow-hidden bg-gradient-to-b from-surface to-surface-container-low pb-12 pt-16">

          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2">

            <img
              className="h-full w-full object-cover opacity-10"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCU2Fe03B06N1qoOuJd8RtxW2WSsm1uoQrXSPVpGZRamA0FpPEo8uMNK37KvWolR01wA5rQ-fmsgdVoioA8DNfsgJ7e9Cl02t5l1IyK7HIaNxaqPMTkyjTbPJ8yMCa4Dl_M286OOr4-Uwf4vkjQFTHD4kko3WCtM0gMPE3xqJTx0D6ZZW5m8tpI9-uutVBFm30uTlQQ4_utwW9Y2TMyr8lyNM8TmPcU_u7SB0P6X25I_bLHAXxysVjSQPObCXrLn5xx6DlcsGJXeF0"
              alt=""
            />

            <img src={brazil} alt="Brasil" className="absolute inset-0 m-auto w-[600px] text-[#003B6F] opacity-20 blur-[1px]"/>

          </div>

          <div className="relative z-10 mx-auto grid w-full grid-cols-1 items-center gap-12 px-20 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold uppercase text-blue-700">
                <span className="material-symbols-outlined text-sm">analytics</span>
                Dados Integrados DATASUS
              </div>

              <h1 className="mb-6 text-4xl font-extrabold leading-tight tracking-tight md:text-8xl">
                Monitoramento Estrategico de <span className="text-primary-container">DCNT</span> no Brasil
              </h1>
              <p className="mb-10 max-w-3xl text-lg leading-relaxed text-on-surface-variant">
                Acesso transparente a indicadores epidemiologicos e tendencias de Doencas Cronicas Nao Transmissiveis,
                apoiando decisoes em saude com dados do DATASUS e previsoes visualmente guiadas.
              </p>

              <div className="flex flex-wrap gap-4">
                <Link to="/doencas/hipertensao" className="flex items-center gap-2 rounded-xl bg-primary px-8 py-4 font-bold text-white transition-all hover:bg-primary-container">
                  Explorar Indicadores
                  <span className="material-symbols-outlined">arrow_forward</span>
                </Link>

                <Link to="/relatorios" className="glass-card rounded-xl border border-outline/30 px-8 py-4 font-bold transition-all hover:bg-surface-container">
                  Relatorios Anuais
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Seções de doenças */}
        <Circulatorio />
        <Respiratorias />
        <Neoplasias />
        <Metabolicas />
      </main>

      <Footer />
    </div>
  )
}

export default Home
