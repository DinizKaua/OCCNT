// GRÁFICOS
let chartCombinado = null; // instância do gráfico combinado

// função que cria o gráfico combinado com dados originais e previsão
function createChartCombinado(dadosOriginais, dadosPrevisao) {
    const ctx = document.getElementById('combined-chart').getContext('2d');
    
    if (chartCombinado) {
        chartCombinado.destroy();
    }

    // Combina os anos de ambos os datasets
    const labelsOriginais = dadosOriginais.map(item => item.ano);
    const labelsPrevisao = dadosPrevisao.map(item => item.ano);
    const allLabels = [...new Set([...labelsOriginais, ...labelsPrevisao])].sort();

    const valoresOriginais = dadosOriginais.map(item => item.valor);
    const valoresPrevisao = dadosPrevisao.map(item => item.valor);

    // Pega o último valor do histórico para conectar com a previsão
    const ultimoAnoHistorico = labelsOriginais[labelsOriginais.length - 1];
    const ultimoValorHistorico = valoresOriginais[valoresOriginais.length - 1];

    // Adiciona o último ponto do histórico no início da previsão
    const dadosPrevisaoComConexao = [{x: ultimoAnoHistorico, y: ultimoValorHistorico}, 
                                      ...labelsPrevisao.map((ano, idx) => ({x: ano, y: valoresPrevisao[idx]}))];

    chartCombinado = new Chart(ctx, { 
        type: 'line',
        data: {
            labels: allLabels,   
            datasets: [
                {
                    label: 'Histórico',
                    data: labelsOriginais.map((ano, idx) => ({x: ano, y: valoresOriginais[idx]})),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Previsão',
                    data: dadosPrevisaoComConexao,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                title: {
                    display: true,
                    text: 'Histórico e Previsão',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    padding: 20
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 12
                        }
                    }
                }
            }
        }
    });
}

// função que carrega os dados do arquivo json
async function loadDataFromJSON(url) {
    console.log('Tentando carregar:', url);
    try {
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        const data = await response.json();
        console.log('Dados recebidos:', data);
        
        // verifica se os dados estão no formato esperado
        if (data.ok && data.dados_originais && data.previsao) {
            console.log('Formato válido! Criando gráfico combinado...');
            createChartCombinado(data.dados_originais, data.previsao);
            
            // exibe informações adicionais
            console.log(`Doença: ${data.doenca}`);
            console.log(`Modelo: ${data.modelo}`);
            console.log(`Tipo: ${data.tipo}`);
        } else {
            console.error('Formato de dados inválido:', {
                ok: data.ok,
                temDadosOriginais: !!data.dados_originais,
                temPrevisao: !!data.previsao
            });
        }
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM carregado!');
    console.log('Canvas combinado:', document.getElementById('combined-chart'));
    
    // Captura o parâmetro 'disease' da URL
    const urlParams = new URLSearchParams(window.location.search);
    const diseaseId = urlParams.get('disease');
    
    console.log('ID da doença:', diseaseId);
    
    if (diseaseId) {
        // AJUSTE A URL DA SUA API AQUI
        const apiUrl = `http://192.168.1.106:5000/api/v1/doencas/${diseaseId}/series`;
        loadDataFromJSON(apiUrl);
    } else {
        console.error('Nenhuma doença selecionada na URL');
        alert('Por favor, selecione uma doença da lista.');
    }
});