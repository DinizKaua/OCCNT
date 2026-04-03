import Card from "../components/Card"

function Neoplasias() {

  const dados = [
    {
      title: "Colo do Útero",
      trend: "+0.2%",
      trendType: "up"
    },
    {
      title: "Mama",
      trend: "+0.3%",
      trendType: "up"
    },
    {
      title: "Próstata",
      trend: "+0.4%",
      trendType: "up"
    },
    {
      title: "Pulmão",
      trend: "+0.5%",
      trendType: "up"
    },
    {
      title: "Colorretal",
      trend: "+0.6%",
      trendType: "up"
    }
  ]

  return (
    <section>
      <div className="max-w-7xl mx-auto px-6 py-20">

        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-2">
            Neoplasias
          </h2>
          <div className="h-1 w-24 bg-primary rounded-full"></div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">

          {dados.map((item, i) => (
            <Card key={i} {...item} showIcon={false} showButton={false} />
          ))}

        </div>

      </div>
    </section>
  )
}

export default Neoplasias