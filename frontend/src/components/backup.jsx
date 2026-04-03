function Footer() {
  return (
    <footer className="w-full py-12 px-8 mt-20 border-t border-slate-200 bg-[#f2f4f6]">
      
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        
        <p className="text-slate-500 text-sm">
          © 2026 Observatório DCNT - Lint
        </p>

        <div className="flex gap-6">
          <span className="material-symbols-outlined text-slate-400 cursor-pointer hover:text-primary transition-colors">
            public
          </span>
          <span className="material-symbols-outlined text-slate-400 cursor-pointer hover:text-primary transition-colors">
            share
          </span>
          <span className="material-symbols-outlined text-slate-400 cursor-pointer hover:text-primary transition-colors">
            info
          </span>
        </div>

      </div>
      <section className="py-12 bg-primary text-white">
          <div className="max-w-7xl mx-auto px-8 flex flex-wrap justify-center md:justify-between items-center gap-8">
            <div className="flex items-center gap-4">
              <span className="material-symbols-outlined text-5xl opacity-50">verified_user</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70">Fonte de Dados</p>
                <p className="text-xl font-extrabold">DATASUS - Ministério da Saúde</p>
              </div>
            </div>

            <div className="flex gap-12 text-center">
              <div>
                <p className="text-3xl font-black">X+</p>
                <p className="text-xs opacity-70">Registros Analisados</p>
              </div>
              <div>
                <p className="text-3xl font-black">Y+</p>
                <p className="text-xs opacity-70">Municípios Cobertos</p>
              </div>
            </div>
          </div>
        </section>

    </footer>
    
  )
}

export default Footer