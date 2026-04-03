import { Navigate, Route, Routes } from "react-router-dom"

import Home from "./pages/Home"
import DiseaseDetail from "./pages/DiseaseDetail"

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/doencas/:slug" element={<DiseaseDetail />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
