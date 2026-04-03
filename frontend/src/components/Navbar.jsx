import { Link } from "react-router-dom"

function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/70 backdrop-blur-md">
      <nav className="flex items-center px-8 py-4">
        <div className="flex-1">
          <Link to="/" className="text-xl font-bold tracking-tighter text-[#001b3c]">
            Observatorio DCNT
          </Link>
        </div>

        <div className="hidden flex-1 justify-center gap-8 md:flex">
          <Link to="/" className="border-b-2 border-[#004587] pb-1 font-bold text-[#004587]">
            Dados
          </Link>
          <a href="#" className="text-slate-600 transition-colors hover:text-[#004587]">
            Sobre
          </a>
          <a href="#" className="text-slate-600 transition-colors hover:text-[#004587]">
            Repositorio
          </a>
          <a href="#" className="text-slate-600 transition-colors hover:text-[#004587]">
            Contato
          </a>
        </div>

        <div className="flex flex-1 justify-end">
          <button className="rounded-xl bg-gradient-to-r from-primary to-primary-container px-6 py-2 font-medium text-white transition-all hover:opacity-90 active:scale-95">
            Entrar
          </button>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
