import Card from "../components/Card"
import { diseaseCards } from "../data/diseases"

function Circulatorio() {
  return (
    <section className="py-20" id="circulatorio">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10">
          <h2 className="mb-2 text-3xl font-bold">Doencas do Aparelho Circulatorio</h2>
          <div className="h-1 w-24 rounded-full bg-primary"></div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {diseaseCards.map((item) => (
            <Card key={item.slug} {...item} to={`/doencas/${item.slug}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Circulatorio
