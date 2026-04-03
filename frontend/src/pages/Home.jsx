import Navbar from "../components/Navbar"
import Footer from "../components/Footer"
import Circulatorio from "../sections/Circulatorio"

function Home() {
  return (
    <div className="bg-background text-on-surface min-h-screen">

      <Navbar />

      <main className="pb-20">
        
        {/* HERO */}
        <section className="relative min-h-[614px] flex items-center pt-16 pb-24 overflow-hidden bg-gradient-to-b from-surface to-surface-container-low">

          {/* imagem (mantida como você pediu) */}
          <div className="absolute right-0 top-0 w-1/2 h-full opacity-10 pointer-events-none">
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCU2Fe03B06N1qoOuJd8RtxW2WSsm1uoQrXSPVpGZRamA0FpPEo8uMNK37KvWolR01wA5rQ-fmsgdVoioA8DNfsgJ7e9Cl02t5l1IyK7HIaNxaqPMTkyjTbPJ8yMCa4Dl_M286OOr4-Uwf4vkjQFTHD4kko3WCtM0gMPE3xqJTx0D6ZZW5m8tpI9-uutVBFm30uTlQQ4_utwW9Y2TMyr8lyNM8TmPcU_u7SB0P6X25I_bLHAXxysVjSQPObCXrLn5xx6DlcsGJXeF0"
              alt=""
            />
          </div>

          {/*CONTAINER PADRÃO */}
          <div className="mx-auto px-20 w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">

            <div className="lg:col-span-7">

              {/* badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 
                bg-blue-100 text-blue-700 
                rounded-full text-xs font-bold uppercase mb-6">
                <span className="material-symbols-outlined text-sm">analytics</span>
                Dados Integrados DATASUS
              </div>

              {/* título */}
              <h1 className="text-4xl md:text-8xl font-extrabold tracking-tight leading-tight mb-6">
                Monitoramento Estratégico de{" "}
                <span className="text-primary-container">DCNT</span> no Brasil
              </h1>
              {/* descrição */}
              <p className="text-on-surface-variant max-w-4xl text-lg mb-10 leading-relaxed">
                Acesso transparente a indicadores epidemiológicos e tendências de Doenças Crônicas Não Transmissíveis, subsidiando políticas públicas e decisões em saúde fundamentadas em evidências do Ministério da Saúde.
              </p>

              {/* botões */}
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 bg-primary text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary-container transition-all">
                  Explorar Indicadores
                  <span className="material-symbols-outlined">arrow_forward</span>
                </button>

                <button className="px-8 py-4 border border-outline/30 glass-card rounded-xl font-bold hover:bg-surface-container transition-all">
                  Relatórios Anuais
                </button>
              </div>

            </div>

          </div>

        </section>

        <Circulatorio />

      </main>

      <Footer />

    </div>
  )
}

export default Home