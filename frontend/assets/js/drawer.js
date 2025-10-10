// GAVETA DE OPÇÕES DA PAGINA CATEGORIA
document.addEventListener("DOMContentLoaded", () => {
  // Seleciona os componentes
  const drawerContent = document.querySelector(".drawer-content");
  const drawerButton = document.querySelector(".drawer-title");

  if (drawerContent && drawerButton) {
    drawerButton.addEventListener("click", () => {
      // Verifica se a gaveta ja esta aberta
      const expanded = drawerButton.getAttribute("aria-expanded") === "true";  
      // Abre caso fechada, fecha caso aberra
      drawerButton.setAttribute("aria-expanded", !expanded); 
      drawerContent.hidden = expanded;
    });
  }
});
