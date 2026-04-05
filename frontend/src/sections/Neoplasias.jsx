import Card from "../components/Card"
import { neoplasiaDiseaseCards } from "../data/diseases"

// Neoplasias section showing disease cards without icons/buttons for compact display.
function Neoplasias() {
  return (
    <section>
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mb-10">
          <h2 className="mb-2 text-3xl font-bold">Neoplasias</h2>
          <div className="h-1 w-24 rounded-full bg-primary"></div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {neoplasiaDiseaseCards.map((item) => (
            <Card key={item.slug} {...item} showIcon={false} showButton={false} to={`/doencas/${item.slug}`} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default Neoplasias
