import { Link, NavLink } from "react-router-dom"
import logo from "../assets/logo.png"

// Sticky top navigation with active link highlighting.
function Navbar() {
  const linkClassName = ({ isActive }) =>
    isActive
      ? "border-b-2 border-[#004587] pb-1 font-bold text-[#004587]"
      : "text-slate-600 transition-colors hover:text-[#004587]"

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/70 backdrop-blur-md">
      <nav className="mx-auto flex max-w-6xl items-center gap-8 px-8 py-6">
        <div className="min-w-0 flex-1">
          <Link to="/" className="flex items-center">
          <img 
            src={logo} 
            alt="Observatório DCNT" 
            className="h-16 w-auto object-contain -my-3"
          />
        </Link>
        </div>

        <div className="hidden flex-1 justify-center gap-8 md:flex">
          <NavLink to="/" end className={linkClassName}>
            Dados
          </NavLink>
          <NavLink to="/sobre" className={linkClassName}>
            Sobre
          </NavLink>
          <NavLink to="/repositorio" className={linkClassName}>
            Repositorio
          </NavLink>
          <NavLink to="/contato" className={linkClassName}>
            Contato
          </NavLink>
        </div>
      </nav>
    </header>
  )
}

export default Navbar
