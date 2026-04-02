function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 bg-slate-950/40 backdrop-blur-md border-b border-white/10 shadow-xl shadow-cyan-900/10 flex items-center px-8 py-4">

      {/* ESQUERDA */}
      <div className="flex-1">
        <div className="text-2xl font-bold tracking-tighter text-cyan-400">
          Observatório DCNT
        </div>
      </div>

      {/* CENTRO */}
      <div className="flex-1 hidden md:flex justify-center gap-8">
        <a href="#" className="text-slate-400 hover:text-white">Circulatório</a>
        <a href="#" className="text-slate-400 hover:text-white">Respiratórias</a>
        <a href="#" className="text-slate-400 hover:text-white">Neoplasias</a>
        <a href="#" className="text-slate-400 hover:text-white">Diabetes</a>
        <a href="#" className="text-slate-400 hover:text-white">Obesidade</a>
      </div>

      {/* DIREITA */}
      <div className="flex-1 flex justify-end">
        <span className="material-symbols-outlined text-slate-400 hover:text-white text-2xl cursor-pointer">
          account_circle
          </span>
      </div>

    </nav>
  )
}

export default Navbar