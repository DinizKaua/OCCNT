document.addEventListener('DOMContentLoaded', async function() {
    // Pega a categoria da URL
    const urlParams = new URLSearchParams(window.location.search);
    const category = urlParams.get('disease'); 
    
    if (!category) { // se a categoria n existe
        console.error('Categoria não encontrada na URL');
        return;
    }

    try {
        // Carrega o JSON da categoria
        const response = await fetch(`../../pages/category/data/${category}.json`);
        const data = await response.json();
        
        // Preenche título
        document.getElementById('categoryTitle').textContent = data.title;
        
        // Preenche descrição
        const description = document.getElementById('categoryDescription');
        if (Array.isArray(data.description)) {
            description.innerHTML = data.description.map(p => `<p class="content-paragraph">${p}</p>`).join('');
        } else {
            description.innerHTML = data.description.replace(/\n/g, '<br>');
        }
        
        // Preenche lista de doenças
        const diseasesList = document.getElementById('diseasesList');
        diseasesList.innerHTML = data.diseases.map(disease => 
            `<li class="drawer-item">
                <a href="../observatory/observatory.html?disease=${disease.id}&name=${encodeURIComponent(disease.name)}">${disease.name}</a>
            </li>`
        ).join('');
        
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
});