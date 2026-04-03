export const diseaseCards = [
  {
    slug: "hipertensao",
    icon: "cardiology",
    title: "Hipertensao",
    trend: "+2% este ano",
    trendType: "up",
    cidLabel: "I10-I15",
    summary:
      "Analise o comportamento da mortalidade relacionada a hipertensao e gere cenarios de previsao com dados filtrados do DATASUS.",
    context:
      "A hipertensao funciona como porta de entrada para eventos cardiovasculares e exige monitoramento continuo de tendencia, sazonalidade e pressao sobre a rede.",
    insight:
      "A pagina prioriza uma previsao base automatica e depois abre espaco para simulacoes personalizadas com os parametros do modelo.",
    focusCards: [
      {
        icon: "monitor_heart",
        title: "Foco epidemiologico",
        text: "Observe tendencia anual, pontos fora da curva e variacao recente para apoiar decisoes em vigilancia.",
      },
      {
        icon: "database",
        title: "Filtro DATASUS",
        text: "Exportacao orientada para CID-10 I10-I15, mantendo o backend dedicado somente a dados e previsoes.",
      },
      {
        icon: "tune",
        title: "Simulacao posterior",
        text: "Depois da previsao automatica, o usuario pode ajustar horizonte, modelo, confianca e sazonalidade.",
      },
    ],
    exportDefaults: {
      system: "SIM-DO",
      uf: "MA",
      year_start: 2018,
      year_end: 2022,
      granularity: "year",
      month_start: 1,
      month_end: 12,
      icd_prefix: "I10,I11,I12,I13,I14,I15",
    },
    predictDefaults: {
      state: "21",
      mode: "auto",
      model: "arima",
      forecast_years: 3,
      forecast_periods: 12,
      confidence: 0.95,
      seasonal: "auto",
    },
  },
  {
    slug: "avc",
    icon: "neurology",
    title: "AVC",
    trend: "Estavel",
    trendType: "neutral",
    cidLabel: "I60-I69",
    summary:
      "Acompanhe a serie historica de acidente vascular cerebral e compare previsoes salvas com novas configuracoes de modelo.",
    context:
      "AVC combina carga assistencial elevada e necessidade de leitura rapida sobre transicoes de tendencia entre estados e periodos.",
    insight:
      "A tela nova foi desenhada para sair da logica em Jinja2 e concentrar tudo em uma experiencia React orientada por API.",
    focusCards: [
      {
        icon: "neurology",
        title: "Leitura da serie",
        text: "Use a previsao base para identificar persistencia, reversoes e concentracao temporal da carga de obitos.",
      },
      {
        icon: "experiment",
        title: "Ponto de partida",
        text: "O backend executa uma previsao inicial com o modelo padrao e deixa a calibracao fina para o usuario.",
      },
      {
        icon: "conversion_path",
        title: "Comparacao de cenarios",
        text: "Recupere resultados processados, ajuste parametros e avalie como as bandas de confianca mudam.",
      },
    ],
    exportDefaults: {
      system: "SIM-DO",
      uf: "MA",
      year_start: 2018,
      year_end: 2022,
      granularity: "year",
      month_start: 1,
      month_end: 12,
      icd_prefix: "I60,I61,I62,I63,I64,I65,I66,I67,I68,I69",
    },
    predictDefaults: {
      state: "21",
      mode: "auto",
      model: "arima",
      forecast_years: 3,
      forecast_periods: 12,
      confidence: 0.95,
      seasonal: "auto",
    },
  },
  {
    slug: "infarto",
    icon: "heart_check",
    title: "Infarto",
    trend: "+1.5%",
    trendType: "up",
    cidLabel: "I21-I25",
    summary:
      "Monitore infarto com foco em projecoes acionaveis para tomada de decisao e planejamento de resposta assistencial.",
    context:
      "Eventos isquemicos agudos exigem leitura clara dos picos historicos e da tendencia projetada para apoiar priorizacao de recursos.",
    insight:
      "A interface combina historia da doenca, configuracao DATASUS e painel de previsao em uma mesma pagina.",
    focusCards: [
      {
        icon: "ecg_heart",
        title: "Sinal prioritario",
        text: "Observe ultimos anos, pico observado e crescimento projetado para guiar resposta estrategica.",
      },
      {
        icon: "upload_file",
        title: "Entrada de dados",
        text: "A exportacao usa o filtro CID da doenca clicada e devolve um dataset pronto para previsao.",
      },
      {
        icon: "insights",
        title: "Leitura visual",
        text: "Grafico, cards metricos e tabela de previsoes tornam o backend mais facil de explorar no frontend.",
      },
    ],
    exportDefaults: {
      system: "SIM-DO",
      uf: "MA",
      year_start: 2018,
      year_end: 2022,
      granularity: "year",
      month_start: 1,
      month_end: 12,
      icd_prefix: "I21,I22,I23,I24,I25",
    },
    predictDefaults: {
      state: "21",
      mode: "auto",
      model: "arima",
      forecast_years: 3,
      forecast_periods: 12,
      confidence: 0.95,
      seasonal: "auto",
    },
  },
  {
    slug: "icc",
    icon: "ecg",
    title: "ICC",
    trend: "-0.8%",
    trendType: "down",
    cidLabel: "I50",
    summary:
      "Veja a evolucao da insuficiencia cardiaca congestiva em um fluxo que exporta, projeta e compara cenarios no mesmo painel.",
    context:
      "ICC pede acompanhamento de medio prazo, leitura das variacoes anuais e capacidade de simular horizontes diferentes rapidamente.",
    insight:
      "O objetivo aqui e transformar o backend pronto em uma experiencia mais visual, ilustrativa e diretamente conectada ao React.",
    focusCards: [
      {
        icon: "favorite",
        title: "Contexto clinico",
        text: "O painel destaca indicadores que ajudam a reconhecer estabilidade, queda ou reaceleracao da carga observada.",
      },
      {
        icon: "filter_alt",
        title: "Filtro pronto",
        text: "O CID principal da pagina ja nasce configurado para evitar dependencia de templates server-side.",
      },
      {
        icon: "stacked_line_chart",
        title: "Exploracao guiada",
        text: "A previsao inicial serve como base para uma segunda rodada com parametros personalizados.",
      },
    ],
    exportDefaults: {
      system: "SIM-DO",
      uf: "MA",
      year_start: 2018,
      year_end: 2022,
      granularity: "year",
      month_start: 1,
      month_end: 12,
      icd_prefix: "I50",
    },
    predictDefaults: {
      state: "21",
      mode: "auto",
      model: "arima",
      forecast_years: 3,
      forecast_periods: 12,
      confidence: 0.95,
      seasonal: "auto",
    },
  },
]

export function getDiseaseBySlug(slug) {
  return diseaseCards.find((item) => item.slug === slug) ?? null
}
