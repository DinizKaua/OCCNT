import { Navigate, Route, Routes } from "react-router-dom"
import DiseaseDetail from "./pages/DiseaseDetail"
import Home from "./pages/Home"
import PlaceholderPage from "./pages/PlaceholderPage"

const placeholderPages = [
  {
    path: "/informacoes",
    title: "Central de Informacoes",
    eyebrow: "Placeholder ativo",
    description: "Esta pagina simula uma area institucional de apoio. Aqui podem entrar textos, orientacoes e materiais complementares ligados ao observatorio.",
  },
  {
    path: "/sobre",
    title: "Sobre o Observatorio",
    eyebrow: "Placeholder ativo",
    description: "Conteudo provisoriamente mantido para demonstrar navegacao interna no frontend React enquanto a versao definitiva e produzida.",
  },
  {
    path: "/repositorio",
    title: "Repositorio e Integracoes",
    eyebrow: "Placeholder ativo",
    description: "Espaco reservado para documentacao tecnica, links oficiais e materiais de apoio ao projeto.",
  },
  {
    path: "/contato",
    title: "Contato",
    eyebrow: "Placeholder ativo",
    description: "Pagina temporaria para formularios, canais institucionais e mensagens de suporte.",
  },
  {
    path: "/relatorios",
    title: "Relatorios Anuais",
    eyebrow: "Placeholder ativo",
    description: "Area provisoria para relatorios e consolidacoes futuras. O clique permanece dentro do proprio frontend para simular a navegacao.",
  },
  {
    path: "/entrar",
    title: "Acesso de Usuario",
    eyebrow: "Placeholder ativo",
    description: "Area temporaria de autenticacao. O objetivo agora e apenas manter o fluxo visual navegavel dentro do localhost.",
  },
  {
    path: "/privacidade",
    title: "Politica de Privacidade",
    eyebrow: "Placeholder ativo",
    description: "Texto institucional de exemplo para representar futuras politicas e avisos sobre uso dos dados.",
  },
  {
    path: "/termos",
    title: "Termos de Uso",
    eyebrow: "Placeholder ativo",
    description: "Pagina demonstrativa para simular termos, condicoes e regras de acesso da plataforma.",
  },
]

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/doencas/:slug" element={<DiseaseDetail />} />
      {placeholderPages.map((page) => (
        <Route
          key={page.path}
          path={page.path}
          element={<PlaceholderPage {...page} />}
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
