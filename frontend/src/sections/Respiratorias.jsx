import Card from "../components/Card"

function Respiratorias() {

  const dados = [
    {
      icon: "pulmonology",
      title: "DPOC",
      description: "Doença Pulmonar Obstrutiva Crônica",
      trend: "+3.4%",
      trendType: "up"
    },
    {
      icon: "air",
      title: "Asma",
      description: "Incidência em ambientes urbanos",
      trend: "-1.8%",
      trendType: "down"
    }
  ]

  return (
    <section className="">
      <div className="max-w-7xl mx-auto px-6">

        {/* título */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-2">
            Doenças Respiratórias
          </h2>

          <div className="h-1 w-24 bg-primary rounded-full"></div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dados.map((item, index) => (
            <Card key={index} {...item} layout="horizontal" />
          ))}
        </div>

      </div>
    </section>
  )
}

export default Respiratorias