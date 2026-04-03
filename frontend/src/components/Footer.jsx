function Footer() {
  return (
    <footer>
      {/* Banner superior - DATASUS */}
      <section className="py-12 bg-primary text-white">
        <div className="max-w-7xl mx-auto px-20 flex flex-wrap justify-between items-center gap-8">
          <div className="flex items-center gap-4">
            <span className="material-symbols-outlined text-4xl opacity-60">verified_user</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60">Fonte de Dados</p>
              <p className="text-lg font-bold">DATASUS - Ministério da Saúde</p>
            </div>
          </div>
          <div className="flex gap-12 text-center">
            <div>
              <p className="text-4xl font-black">210M+</p>
              <p className="text-xs opacity-60 mt-1">Registros Analisados</p>
            </div>
            <div>
              <p className="text-4xl font-black">5.5k+</p>
              <p className="text-xs opacity-60 mt-1">Municípios Cobertos</p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção principal do footer */}
      <section className="bg-[#f0f2f5] py-12">
        <div className="max-w-7xl mx-auto px-8">
          <div className="flex flex-wrap gap-12 justify-between">
            {/* Coluna Observatório */}
            <div className="max-w-xs">
              <h3 className="font-bold text-[#1a2e4a] text-base mb-3">Observatório DCNT</h3>
              <p className="text-sm text-[#6b7a99] leading-relaxed mb-4">
                Iniciativa de transparência e monitoramento contínuo das condições crônicas no Brasil,
                integrando bases de dados nacionais para a melhoria da saúde pública.
              </p>
            </div>

            {/* Coluna Recursos */}
            <div>
              <h3 className="font-bold text-[#1a2e4a] text-base mb-4">Recursos</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-[#6b7a99] hover:text-[#1a2e4a] transition-colors">DATASUS</a></li>
                <li><a href="#" className="text-sm text-[#6b7a99] hover:text-[#1a2e4a] transition-colors">Portal Gov.br</a></li>
                <li><a href="#" className="text-sm text-[#6b7a99] hover:text-[#1a2e4a] transition-colors">Open Data</a></li>
              </ul>
            </div>

            {/* Coluna Institucional */}
            <div>
              <h3 className="font-bold text-[#1a2e4a] text-base mb-4">Institucional</h3>
              <ul className="space-y-3">
                <li><a href="#" className="text-sm text-[#6b7a99] hover:text-[#1a2e4a] transition-colors">Privacidade</a></li>
                <li><a href="#" className="text-sm text-[#6b7a99] hover:text-[#1a2e4a] transition-colors">Termos de Uso</a></li>
                <li><a href="#" className="text-sm text-[#6b7a99] hover:text-[#1a2e4a] transition-colors">Contato</a></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Barra inferior */}
      <section className="bg-[#f0f2f5] border-t border-[#dde1ea] py-4">
        <div className="max-w-7xl mx-auto px-8 flex justify-between items-center">
          <p className="text-sm text-[#6b7a99]">
            © 2026 Observatório DCNT - Ministério da Saúde
          </p>
          <div className="flex gap-4 items-center">
            <span className="material-symbols-outlined text-xl text-[#6b7a99] cursor-pointer hover:text-[#1a2e4a] transition-colors">language</span>
            <span className="material-symbols-outlined text-xl text-[#6b7a99] cursor-pointer hover:text-[#1a2e4a] transition-colors">share</span>
            <span className="material-symbols-outlined text-xl text-[#6b7a99] cursor-pointer hover:text-[#1a2e4a] transition-colors">info</span>
          </div>
        </div>
      </section>
    </footer>
  );
}

export default Footer;