// NAVEGAÇÃO ENTRE PÁGINAS
document.addEventListener('DOMContentLoaded', function() {
    const navButtons = document.querySelectorAll('.nav-button'); // seleciona todos os nav-button
    navButtons.forEach(button => {
        button.addEventListener('click', function() {  
            const section = this.getAttribute('data-section'); // guarda o atributo de cada button
            switch(section){ // verifica qual botao clicado e redireciona para a pagina
                case 'dados':
                    window.location.href = '/index.html';
                    break;
                    
                case 'sobre':
                    window.location.href = '/pages/others/about.html';
                    break;
                
                case 'repositorio':
                    window.location.href = '/pages/others/repository.html';
                    break;
            }
        })
    })

    const aboutButton = document.querySelector('.about-button'); // selecion o about-button
    if(aboutButton){ // se ele existe
        aboutButton.addEventListener('click', function(){
            window.location.href = 'pages/others/about.html'; // redireciona com o click
        })
    }

    const diseaseCard = document.querySelectorAll('.disease-card'); // seleciona todos os button de doenças
    diseaseCard.forEach(card => {
        card.addEventListener('click', function(){
            const category = this.getAttribute('data-category'); // seleciona a categoria
            window.location.href = `pages/category/category.html?disease=${category}`; // redireciona para a pagina passando a cartegoria como parametro
        })
    })
})