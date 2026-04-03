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

    </footer>
  )
}

export default Footer