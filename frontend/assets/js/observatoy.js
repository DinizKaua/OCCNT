


const API_BASE = "http://localhost:8000";

let categoriaSelecionada = null;
let doencaSelecionada = null;
let tipoSelecionado = null;
let chart = null; // referência pro Chart.js

document.addEventListener("DOMContentLoaded", async function () {
  

  // Lê o parâmetro da URL (ex: categoria.html?nome=Cardiovascular)
  const urlParams = new URLSearchParams(window.location.search);
  const nomeCategoria = urlParams.get("disease");
  const nomeExibido = urlParams.get("name");

  const tituloPagina = document.getElementById("categoryTitle");
  if (tituloPagina && nomeCategoria) {
    tituloPagina.textContent = `${nomeExibido}`;
  }

  // Verifica se a categoria foi passada
  if (!nomeCategoria) {
    console.error("Nenhuma categoria especificada na URL");
    alert("Categoria não especificada.");
    return;
  }

  try {
    // Verifica se a categoria existe na API
    const res = await fetch(`${API_BASE}/categorias`);
    const categorias = await res.json();
    const categoriaValida = categorias.find(
      (c) => c.nome.toLowerCase() === nomeCategoria.toLowerCase()
    );

    if (!categoriaValida) {
      alert("Categoria não encontrada na API!");
      return;
    }

    categoriaSelecionada = categoriaValida.nome;

    // Atualiza título e mostra seção de doenças
    document.getElementById("doencas").classList.remove("hidden");
    document.getElementById("titulo-doencas").textContent = `Opções: ${nomeExibido}`;

    // Busca doenças dessa categoria
    const resDoencas = await fetch(`${API_BASE}/categorias/${categoriaValida.nome}/doencas`);
    const doencas = await resDoencas.json();

    const container = document.getElementById("lista-doencas");
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
  document.getElementById("resultado").classList.add("hidden");
  document.getElementById("resultado-json").textContent = "";

  // resetar gráfico se já existir
  if (chart) {
    chart.destroy();
    chart = null;
  }

  document.getElementById("tipo-dado").classList.remove("hidden");
  document.getElementById("titulo-tipo").textContent = `Tipos de dado para ${nome}`;
  const container = document.getElementById("lista-tipos");
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
  document.getElementById("resultado").classList.add("hidden");
  document.getElementById("resultado-json").textContent = "";

  // resetar gráfico também
  if (chart) {
    chart.destroy();
    chart = null;
  }
  tipoSelecionado = t;
  document.getElementById("parametros").classList.remove("hidden");
}

async function rodarPrevisao() {
  
  const estado = document.getElementById("estado").value || "21 Maranhão";
  const anos = parseInt(document.getElementById("anos-previsao").value || "3", 10);

  const payload = {
    categoria: categoriaSelecionada,
    doenca: doencaSelecionada,
    tipo_dado: tipoSelecionado,
    estado: estado,
    anos_previsao: anos,
    alpha: 0.95,
  };

  const res = await fetch(`${API_BASE}/prever`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Resposta da API /prever:", data);

  // mostra o JSON bruto também
  const out = document.getElementById("resultado-json");
  out.textContent = JSON.stringify(data, null, 2);
  document.getElementById("resultado").classList.remove("hidden");

  desenharGrafico(data);
}

function desenharGrafico(data) {

  const ctx = document.getElementById("grafico-arima").getContext("2d");

  // ---- 1) histórico ----
  const anosHistorico = data.dados_originais.map((p) => p.ano);
  const valoresHistorico = data.dados_originais.map((p) => p.valor);

  // último ponto real
  const ultimoAno = anosHistorico[anosHistorico.length - 1];
  const ultimoValor = valoresHistorico[valoresHistorico.length - 1];

  // ---- 2) previsão ----
  const anosPrev = data.previsao.map((p) => p.ano);
  const valoresPrev = data.previsao.map((p) => p.valor);
  const liPrev = data.previsao.map((p) => p.li);
  const lsPrev = data.previsao.map((p) => p.ls);

  // ---- 3) eixo final de anos ----
  // vamos começar pelo histórico e emendar a previsão
  const labels = [...anosHistorico, ...anosPrev];

  // ---- 4) dataset do histórico ----
  // fica igual ao histórico (nada de null)
  const histData = [...valoresHistorico];

  // ---- 5) dataset da previsão (contínuo) ----
  // aqui está o truque: a previsão vai começar no último ano real,
  // usando o valor real, e depois segue com os valores previstos
  // isso evita aquele "salto" visual
  const prevData = [
    ...Array(anosHistorico.length - 1).fill(null), // até o penúltimo ano, nada
    ultimoValor, // no último ano real, colocamos o valor real
    ...valoresPrev, // e depois os previstos de fato
  ];

  // ---- 6) limites de confiança ----
  // mesma lógica: começam no último ano real com o valor real
  const liData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor, // ancorar
    ...liPrev,
  ];

  const lsData = [
    ...Array(anosHistorico.length - 1).fill(null),
    ultimoValor, // ancorar
    ...lsPrev,
  ];

  // destrói gráfico antigo
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
document.getElementById("btn-prever").addEventListener("click", rodarPrevisao);