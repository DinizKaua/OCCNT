import Navbar from "../components/Navbar"
import Footer from "../components/Footer"

function Home() {
  return (
    <div className="bg-[#0b0e14] text-white min-h-screen">

      <Navbar />

      <main className="pt-28 pb-20 px-6 max-w-7xl mx-auto">
        
        {/* HERO */}
        <header className="mb-20 text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Monitoramento Estratégico de DCNT no Brasil
          </h1>

          <p className="text-gray-400 max-w-2xl mx-auto text-xl">
            Análise avançada de Doenças Crônicas Não Transmissíveis com base em dados consolidados do DATASUS. Informação vital para gestão pública e saúde coletiva
          </p>
        </header>

      </main>

      <Footer />

    </div>
  )
}

export default Home