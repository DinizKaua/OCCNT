function selecionarDoenca(nome, tipos) {
  doencaSelecionada = nome;
  tipoSelecionado = null;

  // Remove seleção anterior
  document.querySelectorAll('#data_list .card').forEach(card => {
    card.classList.remove('selected');
  });

  // Adiciona seleção ao card clicado
  event.target.classList.add('selected');

  document.getElementById("data_type").classList.remove("hidden");
  document.getElementById("type_title").textContent = `Tipos de dado para ${nome}`;
  const container = document.getElementById("type_list");
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
  tipoSelecionado = t;

  // Remove seleção anterior
  document.querySelectorAll('#type_list .card').forEach(card => {
    card.classList.remove('selected');
  });

  // Adiciona seleção ao card clicado
  event.target.classList.add('selected');

  document.getElementById("parameters").classList.remove("hidden");
}

// dps eu caço outro lugar pra essa funcao (tela cheia dos graficos)
function abrirFullscreen(canvasId) {
  const wrapper = document.getElementById(canvasId).closest('.chart-wrapper');
  
  if (!wrapper.classList.contains('fullscreen')) {
    wrapper.classList.add('fullscreen');
    wrapper.querySelector('.btn-fullscreen').textContent = '✕ Fechar';
  } else {
    wrapper.classList.remove('fullscreen');
    wrapper.querySelector('.btn-fullscreen').textContent = '⛶ Tela Cheia';
  }
}