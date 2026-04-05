import Card from "../components/Card"
import { metabolicasDiseaseCards } from "../data/diseases" 

// Metabolic disease section using highlight cards for featured conditions.
function Metabolicas() {
  return (
    <section className="">
      <div className="mx-auto max-w-7xl px-6">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {metabolicasDiseaseCards.map((item) => (
            <Card
              key={item.slug}
              {...item}
              layout="highlight"
              to={`/doencas/${item.slug}`}
            />
          ))}
        </div>

      </div>
    </section>
  )
}

export default Metabolicas