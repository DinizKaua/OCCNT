function Navbar() {
  return (
    <header className="sticky top-0 w-full z-50 bg-white/70 backdrop-blur-md border-b border-slate-200">
      <nav className="flex items-center px-8 py-4">

        <div className="flex-1">
          <span className="text-xl font-bold tracking-tighter text-[#001b3c]">
            Observatório DCNT
          </span>
        </div>

        <div className="flex-1 hidden md:flex justify-center gap-8">
          <a href="#" className="text-[#004587] border-b-2 border-[#004587] pb-1 font-bold">
            Dados
          </a>
          <a href="#" className="text-slate-600 hover:text-[#004587] transition-colors">
            Sobre
          </a>
          <a href="#" className="text-slate-600 hover:text-[#004587] transition-colors">
            Repositório
          </a>
          <a href="#" className="text-slate-600 hover:text-[#004587] transition-colors">
            Contato
          </a>
        </div>

        <div className="flex-1 flex justify-end">
          <button className="px-6 py-2 bg-gradient-to-r from-primary to-primary-container text-white rounded-xl font-medium hover:opacity-90 transition-all active:scale-95">
            Entrar
          </button>
        </div>

      </nav>
    </header>
  )
}

export default Navbar