
const estados = [
  "11 Rondônia",
  "12 Acre",
  "13 Amazonas",
  "14 Roraima",
  "15 Pará",
  "16 Amapá",
  "17 Tocantins",
  "21 Maranhão",
  "22 Piauí",
  "23 Ceará",
  "24 Rio Grande do Norte",
  "25 Paraíba",
  "26 Pernambuco",
  "27 Alagoas",
  "28 Sergipe",
  "29 Bahia",
  "31 Minas Gerais",
  "32 Espírito Santo",
  "33 Rio de Janeiro",
  "35 São Paulo",
  "41 Paraná",
  "42 Santa Catarina",
  "43 Rio Grande do Sul",
  "50 Mato Grosso do Sul",
  "51 Mato Grosso",
  "52 Goiás",
  "53 Distrito Federal"
];

// Função para inicializar o autocomplete
function inicializarAutocomplete() {
  const input = document.getElementById('estado');
  const label = input.parentElement;
  
  // Criar container do autocomplete
  const container = document.createElement('div');
  container.className = 'autocomplete-container';
  
  // Criar lista de sugestões
  const listContainer = document.createElement('div');
  listContainer.id = 'autocomplete-list';
  listContainer.className = 'autocomplete-list';
  
  // Envolver o input
  label.appendChild(container);
  container.appendChild(input);
  container.appendChild(listContainer);
  
  let activeIndex = -1;

  // Evento de input (digitação)
  input.addEventListener('input', function() {
    const value = this.value.toLowerCase();
    listContainer.innerHTML = '';
    activeIndex = -1;

    if (!value) {
      listContainer.classList.remove('show');
      return;
    }

    const filtered = estados.filter(estado => 
      estado.toLowerCase().includes(value)
    );

    if (filtered.length === 0) {
      listContainer.innerHTML = '<div class="no-results">Nenhum estado encontrado</div>';
      listContainer.classList.add('show');
      return;
    }

    filtered.forEach((estado, index) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = estado;
      item.dataset.index = index;
      
      item.addEventListener('click', function() {
        input.value = estado;
        listContainer.classList.remove('show');
        listContainer.innerHTML = '';
      });

      listContainer.appendChild(item);
    });

    listContainer.classList.add('show');
  });

  // Navegação por teclado
  input.addEventListener('keydown', function(e) {
    const items = listContainer.querySelectorAll('.autocomplete-item');
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        input.value = items[activeIndex].textContent;
        listContainer.classList.remove('show');
        listContainer.innerHTML = '';
      }
    } else if (e.key === 'Escape') {
      listContainer.classList.remove('show');
      listContainer.innerHTML = '';
    }
  });

  function updateActive(items) {
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Fechar ao clicar fora
  document.addEventListener('click', function(e) {
    if (!e.target.closest('.autocomplete-container') && 
        !e.target.closest('#estado')) {
      listContainer.classList.remove('show');
      listContainer.innerHTML = '';
    }
  });
}

document.addEventListener("DOMContentLoaded", async function () {
  inicializarAutocomplete();
});