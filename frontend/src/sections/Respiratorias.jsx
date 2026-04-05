import Card from "../components/Card"
import { respiratoryDiseaseCards } from "../data/diseases"

// Respiratory disease section with horizontal cards for quick overview.
function Respiratorias() {
  return (
    <section className="py-8">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10">
          <h2 className="mb-2 text-3xl font-bold">Doencas Respiratorias</h2>
          <div className="h-1 w-24 rounded-full bg-primary"></div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {respiratoryDiseaseCards.map((item) => (
            <Card key={item.slug} {...item} layout="horizontal" to={`/doencas/${item.slug}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Respiratorias
