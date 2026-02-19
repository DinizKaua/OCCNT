// Usa o mesmo hostname do frontend (127.0.0.1 ou localhost), porta 8000
const API_BASE = `${window.location.protocol}//${window.location.hostname}:8000`;

let categoriaSelecionada = null;
let doencaSelecionada = null;
let tipoSelecionado = null;
let chart = null;       // gráfico principal (ARIMA ou mensal)
let chartTheta = null;  // gráfico Theta (anual)

const $ = (id) => document.getElementById(id);

function getModelo() {
  const el = $("modelo");
  return el ? (el.value || "arima").toLowerCase() : "arima";
}

function getModo() {
  const el = $("modo");
  return el ? (el.value || "auto").toLowerCase() : "auto";
}

function isMensalPayload(data) {
  return (
    data &&
    Array.isArray(data.dados_originais) &&
    data.dados_originais.length > 0 &&
    Object.prototype.hasOwnProperty.call(data.dados_originais[0], "mes")
  );
}

function applyModoUi() {
  const modo = getModo();
  const lblAnos = $("label-anos");
  const lblPeriodos = $("label-periodos");
  const lblSeasonal = $("label-seasonal");

  // auto: mostra tudo (usuário pode preencher)
  if (modo === "auto") {
    if (lblAnos) lblAnos.style.display = "";
    if (lblPeriodos) lblPeriodos.style.display = "";
    if (lblSeasonal) lblSeasonal.style.display = "";
    return;
  }

  if (modo === "anual") {
    if (lblAnos) lblAnos.style.display = "";
    if (lblPeriodos) lblPeriodos.style.display = "none";
    if (lblSeasonal) lblSeasonal.style.display = "none";
    return;
  }

  // mensal
  if (lblAnos) lblAnos.style.display = "none";
  if (lblPeriodos) lblPeriodos.style.display = "";
  if (lblSeasonal) lblSeasonal.style.display = "";
}

function resetResultado() {
  const resultSection = $("result");
  if (resultSection) resultSection.classList.add("hidden");

  const resultJson = $("result-json");
  if (resultJson) resultJson.textContent = "";

  if (chart) {
    chart.destroy();
    chart = null;
  }
  if (chartTheta) {
    chartTheta.destroy();
    chartTheta = null;
  }
}

function showResultadoJson(data) {
  const out = $("result-json");
  if (out) out.textContent = JSON.stringify(data, null, 2);

  const resultSection = $("result");
  if (resultSection) resultSection.classList.remove("hidden");
}

function renderResultado(data, modeloEscolhido) {
  const thetaWrapper = $("chart-theta-wrapper");
  const arimaWrapper = $("chart-arima-wrapper");

  const mensal = isMensalPayload(data);

  // mensal: sempre desenha no canvas principal (grafico-arima)
  if (mensal) {
    if (arimaWrapper) arimaWrapper.style.display = "";
    if (thetaWrapper) thetaWrapper.style.display = "none";
    if (chartTheta) {
      chartTheta.destroy();
      chartTheta = null;
    }
    desenharGraficoMensal(data);
    return;
  }

  // anual: escolhe canvas conforme modelo
  if (modeloEscolhido === "theta") {
    if (arimaWrapper) arimaWrapper.style.display = "none";
    if (thetaWrapper) thetaWrapper.style.display = "";
    if (chart) {
      chart.destroy();
      chart = null;
    }
    desenharGraficoTheta(data);
  } else {
    if (arimaWrapper) arimaWrapper.style.display = "";
    if (thetaWrapper) thetaWrapper.style.display = "none";
    if (chartTheta) {
      chartTheta.destroy();
      chartTheta = null;
    }
    desenharGrafico(data);
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  const urlParams = new URLSearchParams(window.location.search);
  const nomeCategoriaSlug = urlParams.get("disease");
  const nomeExibido = urlParams.get("name");
  const modoTeste = urlParams.get("teste") === "1";

  const tituloPagina = $("categoryTitle");
  if (tituloPagina) {
    if (modoTeste) tituloPagina.textContent = "Teste";
    else if (nomeExibido) tituloPagina.textContent = nomeExibido;
  }

  const modoSelect = $("modo");
  if (modoSelect) {
    modoSelect.addEventListener("change", applyModoUi);
  }
  applyModoUi();

  if (modoTeste) {
    const analyzedSection = $("analyzed_data");
    if (analyzedSection) analyzedSection.classList.add("hidden");

    const dataTypeSection = $("data_type");
    if (dataTypeSection) dataTypeSection.classList.add("hidden");

    const btnPrever = $("btn-prever");
    if (btnPrever) btnPrever.style.display = "none";

    const btnMensal = $("btn-mensal");
    if (btnMensal) btnMensal.style.display = "none";

    const paramsSection = $("parameters");
    if (paramsSection) paramsSection.classList.remove("hidden");
    return;
  }

  if (!nomeCategoriaSlug) {
    alert("Categoria não especificada.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/categorias`);
    if (!res.ok) throw new Error("Falha ao carregar categorias");
    const categorias = await res.json();

    const categoriaValida = categorias.find(
      (c) => c.nome.toLowerCase() === nomeCategoriaSlug.toLowerCase()
    );

    if (!categoriaValida) {
      alert("Categoria não encontrada na API!");
      return;
    }

    categoriaSelecionada = categoriaValida.nome;

    const analyzedSection = $("analyzed_data");
    if (analyzedSection) analyzedSection.classList.remove("hidden");

    const dataTitle = $("data_title");
    if (dataTitle) dataTitle.textContent = `Opções: ${nomeExibido || categoriaValida.nome}`;

    const resDoencas = await fetch(`${API_BASE}/categorias/${categoriaValida.nome}/doencas`);
    if (!resDoencas.ok) throw new Error("Falha ao carregar doenças");
    const doencas = await resDoencas.json();

    const container = $("data_list");
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

  resetResultado();

  const dataTypeSection = $("data_type");
  if (dataTypeSection) dataTypeSection.classList.remove("hidden");

  const typeTitle = $("type_title");
  if (typeTitle) typeTitle.textContent = `Tipos de dado para ${nome}`;

  const container = $("type_list");
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
  resetResultado();
  tipoSelecionado = t;

  const paramsSection = $("parameters");
  if (paramsSection) paramsSection.classList.remove("hidden");
}

async function rodarPrevisao() {
  if (!categoriaSelecionada || !doencaSelecionada || !tipoSelecionado) {
    alert("Selecione uma opção de dado e um tipo de dado antes de rodar a previsão.");
    return;
  }

  const estado = ($("estado") && $("estado").value) ? $("estado").value : "21 Maranhão";
  const anos = parseInt(($("anos-previsao") && $("anos-previsao").value) ? $("anos-previsao").value : "3", 10);
  const periodos = parseInt(($("periodos-previsao") && $("periodos-previsao").value) ? $("periodos-previsao").value : "12", 10);
  const alpha = parseFloat(($("alpha") && $("alpha").value) ? $("alpha").value : "0.95");
  const seasonal = !!($("seasonal") && $("seasonal").checked);

  const modelo = getModelo();
  const modo = getModo();

  const payload = {
    categoria: categoriaSelecionada,
    doenca: doencaSelecionada,
    tipo_dado: tipoSelecionado,
    estado: estado,

    // novos:
    modelo: modelo,       // arima|theta
    modo: modo,           // auto|anual|mensal
    anos_previsao: anos,
    periodos_previsao: periodos,
    alpha: alpha,
    seasonal: seasonal,
  };

  try {
    resetResultado();

    const res = await fetch(`${API_BASE}/prever`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j && j.detail ? `\n\n${j.detail}` : "";
      } catch (_) {}
      alert(`Erro ao obter previsão. Verifique o backend.${detail}`);
      return;
    }

    const data = await res.json();
    showResultadoJson(data);
    renderResultado(data, modelo);

  } catch (err) {
    console.error("Erro ao rodar previsão:", err);
    alert("Erro ao fazer a previsão. Veja o console para mais detalhes.");
  }
}

async function rodarPrevisaoMensal() {
  try {
    const res = await fetch(`${API_BASE}/prever/mensal`);
    if (!res.ok) {
      alert("Erro ao obter previsão mensal. Verifique o backend.");
      return;
    }

    const data = await res.json();
    showResultadoJson(data);

    // esse endpoint é legado: assume mensal
    renderResultado(data, "arima");
  } catch (err) {
    console.error("Erro ao rodar previsão mensal:", err);
    alert("Erro ao fazer a previsão mensal. Veja o console para mais detalhes.");
  }
}

async function rodarPrevisaoCsv() {
  const fileInput = $("csv-file");
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    alert("Selecione um arquivo CSV.");
    return;
  }

  const estado = ($("estado") && $("estado").value) ? $("estado").value : "21 Maranhão";
  const anos = parseInt(($("anos-previsao") && $("anos-previsao").value) ? $("anos-previsao").value : "3", 10);
  const periodos = parseInt(($("periodos-previsao") && $("periodos-previsao").value) ? $("periodos-previsao").value : "12", 10);
  const alpha = parseFloat(($("alpha") && $("alpha").value) ? $("alpha").value : "0.95");
  const seasonal = !!($("seasonal") && $("seasonal").checked);

  const modelo = getModelo(); // arima|theta
  const modo = getModo();     // auto|anual|mensal

  const form = new FormData();
  form.append("file", fileInput.files[0]);
  form.append("estado", estado);
  form.append("modo", modo);
  form.append("modelo", modelo);
  form.append("anos_previsao", String(anos));
  form.append("periodos_previsao", String(periodos));
  form.append("alpha", String(alpha));
  form.append("seasonal", seasonal ? "true" : "false");

  try {
    resetResultado();

    const res = await fetch(`${API_BASE}/teste/prever/csv`, { method: "POST", body: form });
    if (!res.ok) {
      let detail = "";
      try {
        const j = await res.json();
        detail = j && j.detail ? `\n\n${j.detail}` : "";
      } catch (_) {}
      alert(`Erro ao obter previsão via CSV. Verifique o backend.${detail}`);
      return;
    }

    const data = await res.json();
    showResultadoJson(data);
    renderResultado(data, modelo);

  } catch (err) {
    console.error("Erro ao rodar previsão via CSV:", err);
    alert("Erro ao fazer a previsão via CSV. Veja o console para mais detalhes.");
  }
}

/* ======= GRÁFICOS (mantidos) ======= */

function desenharGrafico(data) {
  const canvas = document.getElementById("grafico-arima");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const anosHistorico = data.dados_originais.map((p) => p.ano);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);
  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

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

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Histórico", data: histData, borderColor: "rgba(14,165,233,1)", backgroundColor: "rgba(14,165,233,0.25)", tension: 0.25, spanGaps: true, pointRadius: 3 },
        { label: "Previsão", data: prevData, borderColor: "rgba(250,204,21,1)", backgroundColor: "rgba(250,204,21,0.15)", borderDash: [5, 5], tension: 0.25, spanGaps: true, pointRadius: 3 },
        { label: "Limite inferior", data: liData, borderColor: "rgba(248,113,113,0.7)", borderDash: [3, 3], pointRadius: 0, tension: 0.25, spanGaps: true },
        { label: "Limite superior", data: lsData, borderColor: "rgba(190,242,100,0.7)", borderDash: [3, 3], pointRadius: 0, tension: 0.25, spanGaps: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: { x: { ticks: { color: "#000000ff" } }, y: { beginAtZero: true, ticks: { color: "#000000ff" } } },
      plugins: {
        legend: { labels: { color: "#000000ff" } },
        title: { display: true, text: `${data.estado_rotulo} • ${data.modelo}`, color: "#000000ff" },
      },
    },
  });
}

function desenharGraficoTheta(data) {
  const canvas = document.getElementById("grafico-theta");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const anosHistorico = data.dados_originais.map((p) => p.ano);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);
  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

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

  if (chartTheta) chartTheta.destroy();

  chartTheta = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Histórico", data: histData, borderColor: "rgba(14,165,233,1)", backgroundColor: "rgba(14,165,233,0.25)", tension: 0.25, spanGaps: true, pointRadius: 3 },
        { label: "Previsão (Theta)", data: prevData, borderColor: "rgba(250,204,21,1)", backgroundColor: "rgba(250,204,21,0.15)", borderDash: [5, 5], tension: 0.25, spanGaps: true, pointRadius: 3 },
        { label: "Limite inferior (Theta)", data: liData, borderColor: "rgba(248,113,113,0.7)", borderDash: [3, 3], pointRadius: 0, tension: 0.25, spanGaps: true },
        { label: "Limite superior (Theta)", data: lsData, borderColor: "rgba(190,242,100,0.7)", borderDash: [3, 3], pointRadius: 0, tension: 0.25, spanGaps: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: { x: { ticks: { color: "#000000ff" } }, y: { beginAtZero: true, ticks: { color: "#000000ff" } } },
      plugins: {
        legend: { labels: { color: "#000000ff" } },
        title: { display: true, text: `${data.estado_rotulo} • ${data.modelo}`, color: "#000000ff" },
      },
    },
  });
}

function desenharGraficoMensal(data) {
  const canvas = document.getElementById("grafico-arima");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  const mesesHistorico = data.dados_originais.map((p) => p.mes);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);
  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

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

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Histórico", data: histData, borderColor: "rgba(14,165,233,1)", backgroundColor: "rgba(14,165,233,0.25)", tension: 0.25, spanGaps: true, pointRadius: 3 },
        { label: "Previsão", data: prevData, borderColor: "rgba(250,204,21,1)", backgroundColor: "rgba(250,204,21,0.15)", borderDash: [5, 5], tension: 0.25, spanGaps: true, pointRadius: 3 },
        { label: "Limite inferior", data: liData, borderColor: "rgba(248,113,113,0.7)", borderDash: [3, 3], pointRadius: 0, tension: 0.25, spanGaps: true },
        { label: "Limite superior", data: lsData, borderColor: "rgba(190,242,100,0.7)", borderDash: [3, 3], pointRadius: 0, tension: 0.25, spanGaps: true },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: { x: { ticks: { color: "#000000ff" } }, y: { beginAtZero: true, ticks: { color: "#000000ff" } } },
      plugins: {
        legend: { labels: { color: "#000000ff" } },
        title: { display: true, text: `${data.estado_rotulo} • ${data.modelo} (mensal)`, color: "#000000ff" },
      },
    },
  });
}

/* ======= BOTÕES ======= */
const btnPrever = document.getElementById("btn-prever");
if (btnPrever) btnPrever.addEventListener("click", rodarPrevisao);

const btnMensal = document.getElementById("btn-mensal");
if (btnMensal) btnMensal.addEventListener("click", rodarPrevisaoMensal);

const btnTesteCsv = document.getElementById("btn-teste-csv");
if (btnTesteCsv) btnTesteCsv.addEventListener("click", rodarPrevisaoCsv);
