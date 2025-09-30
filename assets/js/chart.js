// GRÁFICOS
let chartOriginais = null; // instância do gráfico de dados originais
let chartPrevisao = null;  // instância do gráfico de previsão

// função que cria o gráfico de dados originais
function createChartOriginais(dados) {
    const ctx = document.getElementById('original-chart').getContext('2d');
    
    if (chartOriginais) {
        chartOriginais.destroy();
    }

    const labels = dados.map(item => item.ano);
    const valores = dados.map(item => item.valor);

    chartOriginais = new Chart(ctx, { 
        type: 'line',
        data: {
            labels: labels,   
            datasets: [{
                label: 'Dados Originais',
                data: valores,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                title: {
                    display: true,
                    text: 'Dados Originais',
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

// função que cria o gráfico de previsão
function createChartPrevisao(dados) {
    const ctx = document.getElementById('preview-chart').getContext('2d');
    
    if (chartPrevisao) {
        chartPrevisao.destroy();
    }

    const labels = dados.map(item => item.ano);
    const valores = dados.map(item => item.valor);

    chartPrevisao = new Chart(ctx, { 
        type: 'line',
        data: {
            labels: labels,   
            datasets: [{
                label: 'Previsão',
                data: valores,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            plugins: {
                title: {
                    display: true,
                    text: 'Previsão',
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
    console.log('🔍 Tentando carregar:', url);
    try {
        const response = await fetch(url);
        console.log('📡 Response status:', response.status);
        
        const data = await response.json();
        console.log('📊 Dados recebidos:', data);
        
        // verifica se os dados estão no formato esperado
        if (data.ok && data.dados_originais && data.previsao) {
            console.log('✅ Formato válido! Criando gráficos...');
            createChartOriginais(data.dados_originais);
            createChartPrevisao(data.previsao);
            
            // exibe informações adicionais
            console.log(`Doença: ${data.doenca}`);
            console.log(`Modelo: ${data.modelo}`);
            console.log(`Tipo: ${data.tipo}`);
        } else {
            console.error('❌ Formato de dados inválido:', {
                ok: data.ok,
                temDadosOriginais: !!data.dados_originais,
                temPrevisao: !!data.previsao
            });
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM carregado!');
    console.log('Canvas originais:', document.getElementById('original-chart'));
    console.log('Canvas previsão:', document.getElementById('preview-chart'));
    
    // Captura o parâmetro 'disease' da URL
    const urlParams = new URLSearchParams(window.location.search);
    const diseaseId = urlParams.get('disease');
    
    console.log('🔍 ID da doença:', diseaseId);
    
    if (diseaseId) {
        // AJUSTE A URL DA SUA API AQUI
        const apiUrl = `http://192.168.1.105:5000/api/v1/doencas/${diseaseId}/series`;

        
        loadDataFromJSON(apiUrl);
    } else {
        console.error('Nenhuma doença selecionada na URL');
        alert('Por favor, selecione uma doença da lista.');
    }
});