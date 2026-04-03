import Card from "../components/Card"

function Circulatorio() {

  const dados = [
    {
      icon: "cardiology",
      title: "Hipertensão",
      trend: "+2% este ano",
      trendType: "up"
    },
    {
      icon: "neurology",
      title: "AVC",
      trend: "Estável",
      trendType: "neutral"
    },
    {
      icon: "heart_check",
      title: "Infarto",
      trend: "+1.5%",
      trendType: "up"
    },
    {
      icon: "ecg",
      title: "ICC",
      trend: "-0.8%",
      trendType: "down"
    }
  ]

  return (
    <section className="py-20">

      <div className="max-w-7xl mx-auto px-6">

        {/* título */}
        <div className="mb-10">
          <h2 className="text-3xl font-bold mb-2">
            Doenças do Aparelho Circulatório
          </h2>

          <div className="h-1 w-24 bg-primary rounded-full"></div>
        </div>

        {/* grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {dados.map((item, index) => (
            <Card key={index} {...item} />
          ))}
        </div>

      </div>

    </section>
  )
}

export default Circulatorio