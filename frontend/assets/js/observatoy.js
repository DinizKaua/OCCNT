const API_BASE = "http://localhost:8000";

let categoriaSelecionada = null;
let doencaSelecionada = null;
let tipoSelecionado = null;
let chart = null;       // gráfico ARIMA
let chartTheta = null;  // gráfico Theta

document.addEventListener("DOMContentLoaded", async function () {
  // Lê o parâmetro da URL (ex: observatory.html?disease=sepse&name=Sepse)
  const urlParams = new URLSearchParams(window.location.search);
  const nomeCategoriaSlug = urlParams.get("disease");
  const nomeExibido = urlParams.get("name");
  const modoTeste = urlParams.get("teste") === "1";

  const tituloPagina = document.getElementById("categoryTitle");
  if (tituloPagina) {
    if (modoTeste) {
      tituloPagina.textContent = "Teste";
    } else if (nomeExibido) {
      tituloPagina.textContent = nomeExibido;
    }
  }

  if (modoTeste) {
    const analyzedSection = document.getElementById("analyzed_data");
    if (analyzedSection) {
      analyzedSection.classList.add("hidden");
    }
    const dataTypeSection = document.getElementById("data_type");
    if (dataTypeSection) {
      dataTypeSection.classList.add("hidden");
    }
    const btnPrever = document.getElementById("btn-prever");
    if (btnPrever) {
      btnPrever.style.display = "none";
    }
    const btnMensal = document.getElementById("btn-mensal");
    if (btnMensal) {
      btnMensal.style.display = "none";
    }
    const paramsSection = document.getElementById("parameters");
    if (paramsSection) {
      paramsSection.classList.remove("hidden");
    }
    return;
  }

  if (!nomeCategoriaSlug) {
    console.error("Nenhuma categoria especificada na URL");
    alert("Categoria não especificada.");
    return;
  }

  try {
    // Verifica se a categoria existe na API
    const res = await fetch(`${API_BASE}/categorias`);
    if (!res.ok) {
      throw new Error("Falha ao carregar categorias");
    }
    const categorias = await res.json();

    const categoriaValida = categorias.find(
      (c) => c.nome.toLowerCase() === nomeCategoriaSlug.toLowerCase()
    );

    if (!categoriaValida) {
      alert("Categoria não encontrada na API!");
      return;
    }

    categoriaSelecionada = categoriaValida.nome;

    // Atualiza título e mostra seção de doenças
    const analyzedSection = document.getElementById("analyzed_data");
    if (analyzedSection) {
      analyzedSection.classList.remove("hidden");
    }

    const dataTitle = document.getElementById("data_title");
    if (dataTitle) {
      dataTitle.textContent = `Opções: ${nomeExibido || categoriaValida.nome}`;
    }

    // Busca doenças dessa categoria
    const resDoencas = await fetch(
      `${API_BASE}/categorias/${categoriaValida.nome}/doencas`
    );
    if (!resDoencas.ok) {
      throw new Error("Falha ao carregar doenças");
    }
    const doencas = await resDoencas.json();

    const container = document.getElementById("data_list");
    if (!container) return;
    container.innerHTML = "";

    doencas.forEach((d) => {
      const div = document.createElement("div");
      div.className = "card";
      div.textContent = d.nome;
      div.onclick = () => selecionarDoenca(d.nome, d.tipos_dado);
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Erro ao carregar doenças:", err);
    alert("Erro ao carregar informações da categoria.");
  }
});

function selecionarDoenca(nome, tipos) {
  doencaSelecionada = nome;
  tipoSelecionado = null;

  // limpar resultados anteriores
  const resultSection = document.getElementById("result");
  if (resultSection) {
    resultSection.classList.add("hidden");
  }
  const resultJson = document.getElementById("result-json");
  if (resultJson) {
    resultJson.textContent = "";
  }

  // resetar gráficos se já existirem
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (chartTheta) {
    chartTheta.destroy();
    chartTheta = null;
  }

  // mostrar opções de tipo de dado
  const dataTypeSection = document.getElementById("data_type");
  if (dataTypeSection) {
    dataTypeSection.classList.remove("hidden");
  }

  const typeTitle = document.getElementById("type_title");
  if (typeTitle) {
    typeTitle.textContent = `Tipos de dado para ${nome}`;
  }

  const container = document.getElementById("type_list");
  if (!container) return;
  container.innerHTML = "";

  tipos.forEach((t) => {
    const div = document.createElement("div");
    div.className = "card";
    div.textContent = t;
    div.onclick = () => selecionarTipo(t);
    container.appendChild(div);
  });
}

function selecionarTipo(t) {
  // limpar resultado da previsão anterior
  const resultSection = document.getElementById("result");
  if (resultSection) {
    resultSection.classList.add("hidden");
  }
  const resultJson = document.getElementById("result-json");
  if (resultJson) {
    resultJson.textContent = "";
  }

  // resetar gráficos
  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (chartTheta) {
    chartTheta.destroy();
    chartTheta = null;
  }

  tipoSelecionado = t;

  const paramsSection = document.getElementById("parameters");
  if (paramsSection) {
    paramsSection.classList.remove("hidden");
  }
}

async function rodarPrevisao() {
  if (!categoriaSelecionada || !doencaSelecionada || !tipoSelecionado) {
    alert("Selecione uma opção de dado e um tipo de dado antes de rodar a previsão.");
    return;
  }

  const estadoInput = document.getElementById("estado");
  const anosInput = document.getElementById("anos-previsao");

  const estado =
    (estadoInput && estadoInput.value) ? estadoInput.value : "21 Maranhão";
  const anos = parseInt(
    (anosInput && anosInput.value) ? anosInput.value : "3",
    10
  );

  const payload = {
    categoria: categoriaSelecionada,
    doenca: doencaSelecionada,
    tipo_dado: tipoSelecionado,
    estado: estado,
    anos_previsao: anos,
    alpha: 0.95,
  };

  try {
    const thetaWrapper = document.getElementById("chart-theta-wrapper");
    if (thetaWrapper) {
      thetaWrapper.style.display = "";
    }

    const [resArima, resTheta] = await Promise.all([
      fetch(`${API_BASE}/prever`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
      fetch(`${API_BASE}/prever/theta`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }),
    ]);

    if (!resArima.ok || !resTheta.ok) {
      console.error("Erro nas respostas da API:", resArima, resTheta);
      alert("Erro ao obter previsões. Verifique o backend.");
      return;
    }

    const dataArima = await resArima.json();
    const dataTheta = await resTheta.json();

    console.log("Resposta da API /prever:", dataArima);
    console.log("Resposta da API /prever/theta:", dataTheta);

    const out = document.getElementById("result-json");
    if (out) {
      out.textContent = JSON.stringify(
        { arima: dataArima, theta: dataTheta },
        null,
        2
      );
    }

    const resultSection = document.getElementById("result");
    if (resultSection) {
      resultSection.classList.remove("hidden");
    }

    desenharGrafico(dataArima);
    desenharGraficoTheta(dataTheta);
  } catch (err) {
    console.error("Erro ao rodar previsão:", err);
    alert("Erro ao fazer a previsão. Veja o console para mais detalhes.");
  }
}

async function rodarPrevisaoMensal() {
  try {
    const res = await fetch(`${API_BASE}/prever/mensal`);
    if (!res.ok) {
      console.error("Erro na resposta da API:", res);
      alert("Erro ao obter previsão mensal. Verifique o backend.");
      return;
    }

    const data = await res.json();
    console.log("Resposta da API /prever/mensal:", data);

    const out = document.getElementById("result-json");
    if (out) {
      out.textContent = JSON.stringify(data, null, 2);
    }

    const resultSection = document.getElementById("result");
    if (resultSection) {
      resultSection.classList.remove("hidden");
    }

    const thetaWrapper = document.getElementById("chart-theta-wrapper");
    if (thetaWrapper) {
      thetaWrapper.style.display = "none";
    }
    if (chartTheta) {
      chartTheta.destroy();
      chartTheta = null;
    }

    desenharGraficoMensal(data);
  } catch (err) {
    console.error("Erro ao rodar previsão mensal:", err);
    alert("Erro ao fazer a previsão mensal. Veja o console para mais detalhes.");
  }
}

async function rodarPrevisaoCsv() {
  const fileInput = document.getElementById("csv-file");
  const estadoInput = document.getElementById("estado");
  const anosInput = document.getElementById("anos-previsao");
  const periodosInput = document.getElementById("periodos-previsao");
  const alphaInput = document.getElementById("alpha");
  const seasonalInput = document.getElementById("seasonal");

  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Selecione um arquivo CSV.");
    return;
  }

  const estado =
    (estadoInput && estadoInput.value) ? estadoInput.value : "21 Maranhão";
  const anos = parseInt(
    (anosInput && anosInput.value) ? anosInput.value : "3",
    10
  );
  const periodos = parseInt(
    (periodosInput && periodosInput.value) ? periodosInput.value : "12",
    10
  );
  const alpha = parseFloat(
    (alphaInput && alphaInput.value) ? alphaInput.value : "0.95"
  );
  const seasonal = !!(seasonalInput && seasonalInput.checked);

  const form = new FormData();
  form.append("file", fileInput.files[0]);
  form.append("estado", estado);
  form.append("modo", "auto");
  form.append("anos_previsao", String(anos));
  form.append("periodos_previsao", String(periodos));
  form.append("alpha", String(alpha));
  form.append("seasonal", seasonal ? "true" : "false");

  try {
    const res = await fetch(`${API_BASE}/teste/prever/csv`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      console.error("Erro na resposta da API:", res);
      alert("Erro ao obter previsão via CSV. Verifique o backend.");
      return;
    }

    const data = await res.json();
    console.log("Resposta da API /teste/prever/csv:", data);

    const out = document.getElementById("result-json");
    if (out) {
      out.textContent = JSON.stringify(data, null, 2);
    }

    const resultSection = document.getElementById("result");
    if (resultSection) {
      resultSection.classList.remove("hidden");
    }

    const isMensal =
      Array.isArray(data.dados_originais) &&
      data.dados_originais.length > 0 &&
      Object.prototype.hasOwnProperty.call(data.dados_originais[0], "mes");

    const thetaWrapper = document.getElementById("chart-theta-wrapper");
    if (thetaWrapper) {
      thetaWrapper.style.display = isMensal ? "none" : "";
    }
    if (chartTheta) {
      chartTheta.destroy();
      chartTheta = null;
    }

    if (isMensal) {
      desenharGraficoMensal(data);
    } else {
      desenharGrafico(data);
    }
  } catch (err) {
    console.error("Erro ao rodar previsão via CSV:", err);
    alert("Erro ao fazer a previsão via CSV. Veja o console para mais detalhes.");
  }
}

function desenharGrafico(data) {
  const canvas = document.getElementById("grafico-arima");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // histórico
  const anosHistorico = data.dados_originais.map((p) => p.ano);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);

  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

  // previsão
  const anosPrev = data.previsao.map((p) => p.ano);
  const valoresPrev = data.previsao.map((p) => p.valor);
  const liPrev = data.previsao.map((p) => p.li);
  const lsPrev = data.previsao.map((p) => p.ls);

  const labels = [...anosHistorico, ...anosPrev];

  const histData = [...valoresHistorico];

  const prevData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor,
    ...valoresPrev,
  ];

  const liData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor,
    ...liPrev,
  ];

  const lsData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor,
    ...lsPrev,
  ];

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Histórico",
          data: histData,
          borderColor: "rgba(14,165,233,1)",
          backgroundColor: "rgba(14,165,233,0.25)",
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
        {
          label: "Previsão",
          data: prevData,
          borderColor: "rgba(250,204,21,1)",
          backgroundColor: "rgba(250,204,21,0.15)",
          borderDash: [5, 5],
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
        {
          label: "Limite inferior",
          data: liData,
          borderColor: "rgba(248,113,113,0.7)",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
        {
          label: "Limite superior",
          data: lsData,
          borderColor: "rgba(190,242,100,0.7)",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            color: "#000000ff",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#000000ff",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#000000ff",
          },
        },
        title: {
          display: true,
          text: `${data.estado_rotulo} • ${data.modelo}`,
          color: "#000000ff",
        },
      },
    },
  });
}

function desenharGraficoTheta(data) {
  const canvas = document.getElementById("grafico-theta");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // histórico
  const anosHistorico = data.dados_originais.map((p) => p.ano);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);

  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

  // previsão
  const anosPrev = data.previsao.map((p) => p.ano);
  const valoresPrev = data.previsao.map((p) => p.valor);
  const liPrev = data.previsao.map((p) => p.li);
  const lsPrev = data.previsao.map((p) => p.ls);

  const labels = [...anosHistorico, ...anosPrev];

  const histData = [...valoresHistorico];

  const prevData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor,
    ...valoresPrev,
  ];

  const liData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor,
    ...liPrev,
  ];

  const lsData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor,
    ...lsPrev,
  ];

  if (chartTheta) {
    chartTheta.destroy();
  }

  chartTheta = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Histórico",
          data: histData,
          borderColor: "rgba(14,165,233,1)",
          backgroundColor: "rgba(14,165,233,0.25)",
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
        {
          label: "Previsão (Theta)",
          data: prevData,
          borderColor: "rgba(250,204,21,1)",
          backgroundColor: "rgba(250,204,21,0.15)",
          borderDash: [5, 5],
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
        {
          label: "Limite inferior (Theta)",
          data: liData,
          borderColor: "rgba(248,113,113,0.7)",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
        {
          label: "Limite superior (Theta)",
          data: lsData,
          borderColor: "rgba(190,242,100,0.7)",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            color: "#000000ff",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#000000ff",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#000000ff",
          },
        },
        title: {
          display: true,
          text: `${data.estado_rotulo} • ${data.modelo}`,
          color: "#000000ff",
        },
      },
    },
  });
}

function desenharGraficoMensal(data) {
  const canvas = document.getElementById("grafico-arima");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // histórico
  const mesesHistorico = data.dados_originais.map((p) => p.mes);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);

  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

  // previsão
  const mesesPrev = data.previsao.map((p) => p.mes);
  const valoresPrev = data.previsao.map((p) => p.valor);
  const liPrev = data.previsao.map((p) => p.li);
  const lsPrev = data.previsao.map((p) => p.ls);

  const labels = [...mesesHistorico, ...mesesPrev];

  const histData = [...valoresHistorico];

  const prevData = [
    ...Array(mesesHistorico.length - 1).fill(null),
    ultimoValor,
    ...valoresPrev,
  ];

  const liData = [
    ...Array(mesesHistorico.length - 1).fill(null),
    ultimoValor,
    ...liPrev,
  ];

  const lsData = [
    ...Array(mesesHistorico.length - 1).fill(null),
    ultimoValor,
    ...lsPrev,
  ];

  if (chart) {
    chart.destroy();
  }

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Histórico",
          data: histData,
          borderColor: "rgba(14,165,233,1)",
          backgroundColor: "rgba(14,165,233,0.25)",
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
        {
          label: "Previsão",
          data: prevData,
          borderColor: "rgba(250,204,21,1)",
          backgroundColor: "rgba(250,204,21,0.15)",
          borderDash: [5, 5],
          tension: 0.25,
          spanGaps: true,
          pointRadius: 3,
        },
        {
          label: "Limite inferior",
          data: liData,
          borderColor: "rgba(248,113,113,0.7)",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
        {
          label: "Limite superior",
          data: lsData,
          borderColor: "rgba(190,242,100,0.7)",
          borderDash: [3, 3],
          pointRadius: 0,
          tension: 0.25,
          spanGaps: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            color: "#000000ff",
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#000000ff",
          },
        },
      },
      plugins: {
        legend: {
          labels: {
            color: "#000000ff",
          },
        },
        title: {
          display: true,
          text: `${data.estado_rotulo} • ${data.modelo} (mensal)`,
          color: "#000000ff",
        },
      },
    },
  });
}

// ===== EXPORTAR ARIMA PARA CSV =====
function exportarArimaParaCSV() {
  if (!chart) {
    alert("Nenhum gráfico ARIMA disponível para exportar.");
    return;
  }

  const labels = chart.data.labels;        // eixo X (ano ou mês)
  const datasets = chart.data.datasets;   // Histórico, Previsão, LI, LS

  let csv = "Periodo," + datasets.map(ds => ds.label).join(",") + "\n";

  for (let i = 0; i < labels.length; i++) {
    const linha = [labels[i]];

    datasets.forEach(ds => {
      const valor = ds.data[i];
      linha.push(valor != null ? Number(valor).toFixed(2) : "");
    });

    csv += linha.join(",") + "\n";
  }

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "arima_previsao.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  URL.revokeObjectURL(url);
}


document
  .getElementById("btn-prever")
  .addEventListener("click", rodarPrevisao);

document
  .getElementById("btn-mensal")
  .addEventListener("click", rodarPrevisaoMensal);

document
  .getElementById("btn-teste-csv")
  .addEventListener("click", rodarPrevisaoCsv);
document
  .getElementById("btn-export-arima")
  .addEventListener("click", exportarArimaParaCSV);
