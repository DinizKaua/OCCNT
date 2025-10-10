from __future__ import annotations
from typing import List, Dict, Optional

# ----------------------------------------------------------------------
# SEED: categorias e doenças
# ----------------------------------------------------------------------

CATEGORIAS: List[Dict] = [
    {
        "id": 1,
        "slug": "cardiovasculares",
        "nome": "Doenças Cardiovasculares",
        "descricao_curta": "Hipertensão arterial, Arritmias, DAC",
        "descricao_longa": (
            "As doenças cardiovasculares compreendem um grupo de distúrbios que afetam o "
            "coração e os vasos sanguíneos, incluindo infarto agudo do miocárdio, AVC, "
            "hipertensão arterial, insuficiência cardíaca, entre outras."
        ),
    },
    {
        "id": 2,
        "slug": "respiratorias",
        "nome": "Doenças Respiratórias",
        "descricao_curta": "Asma, Bronquite, DPOC",
        "descricao_longa": "Conjunto de condições que afetam vias aéreas e pulmões.",
    },
    {
        "id": 3,
        "slug": "cancer",
        "nome": "Câncer",
        "descricao_curta": "Diversos tipos oncológicos",
        "descricao_longa": "Grupo de doenças caracterizadas por crescimento celular anormal.",
    },
    {
        "id": 4,
        "slug": "neurologicas-mentais",
        "nome": "Doenças Neurológicas e Mentais",
        "descricao_curta": "Alzheimer, Parkinson, Epilepsia",
        "descricao_longa": "Condições do sistema nervoso central e saúde mental.",
    },
    {
        "id": 5,
        "slug": "endocrinas-nutricionais-metabolicas",
        "nome": "Doenças Endócrinas, Nutricionais e Metabólicas",
        "descricao_curta": "Diabetes, Obesidade, Dislipidemias",
        "descricao_longa": "Distúrbios hormonais e do metabolismo.",
    },
    {
        "id": 6,
        "slug": "sensoriais",
        "nome": "Doenças Sensoriais",
        "descricao_curta": "Glaucoma, Surdez, Catarata",
        "descricao_longa": "Condições que afetam visão e audição.",
    },
    {
        "id": 7,
        "slug": "osteomusculares-articulares",
        "nome": "Doenças Osteomusculares e Articulares",
        "descricao_curta": "Artrite, Osteoartrite, Osteoporose",
        "descricao_longa": "Doenças que afetam ossos, articulações e músculos.",
    },
    {
        "id": 8,
        "slug": "outras-condicoes-cronicas-funcionais",
        "nome": "Outras Condições Crônicas Funcionais",
        "descricao_curta": "Lúpus, Celíaca, Endometriose",
        "descricao_longa": "Grupo diverso de condições crônicas funcionais.",
    },
]

# Doenças indexadas por slug (para lookup rápido)
# Campos: slug, nome, categoria_slug, descricao, tipos_de_dado disponíveis
DOENCAS: Dict[str, Dict] = {
    "hipertensao-arterial": {
        "slug": "hipertensao-arterial",
        "nome": "Hipertensão Arterial",
        "categoria_slug": "cardiovasculares",
        "descricao": "Condição crônica de pressão arterial persistentemente elevada.",
        "tipos_de_dado": ["obitos", "internacoes", "incidencia"],
    },
    "doenca-arterial-coronariana": {
        "slug": "doenca-arterial-coronariana",
        "nome": "Doença Arterial Coronariana",
        "categoria_slug": "cardiovasculares",
        "descricao": "Doença causada por aterosclerose das artérias coronárias.",
        "tipos_de_dado": ["obitos", "internacoes"],
    },
    "arritmias": {
        "slug": "arritmias",
        "nome": "Arritmias",
        "categoria_slug": "cardiovasculares",
        "descricao": "Alterações do ritmo cardíaco que podem causar palpitações.",
        "tipos_de_dado": ["internacoes", "incidencia"],
    },
    # Exemplos respiratórios (para quando você ampliar a UI)
    "asma": {
        "slug": "asma",
        "nome": "Asma",
        "categoria_slug": "respiratorias",
        "descricao": "Doença inflamatória crônica das vias aéreas.",
        "tipos_de_dado": ["internacoes", "incidencia"],
    },
}

# ----------------------------------------------------------------------
# Funções utilitárias (categorias)
# ----------------------------------------------------------------------

def listar_categorias() -> List[Dict]:
    """Lista leve para a tela inicial (sem texto longo)."""
    return [
        {
            "id": c["id"],
            "slug": c["slug"],
            "nome": c["nome"],
            "descricao_curta": c["descricao_curta"],
        }
        for c in CATEGORIAS
    ]


def obter_categoria_por_slug(slug: str) -> Optional[Dict]:
    for c in CATEGORIAS:
        if c["slug"] == slug:
            return c
    return None


def listar_doencas_por_categoria(categoria_slug: str) -> List[Dict]:
    return [
        {"slug": d["slug"], "nome": d["nome"]}
        for d in DOENCAS.values()
        if d["categoria_slug"] == categoria_slug
    ]

# ----------------------------------------------------------------------
# Funções utilitárias (doenças)
# ----------------------------------------------------------------------

def listar_doencas(categoria_slug: Optional[str] = None) -> List[Dict]:
    data = list(DOENCAS.values())
    if categoria_slug:
        data = [d for d in data if d["categoria_slug"] == categoria_slug]
    # resposta “leve”
    return [
        {
            "slug": d["slug"],
            "nome": d["nome"],
            "categoria": d["categoria_slug"],
            "tipos_de_dado": d["tipos_de_dado"],
        }
        for d in data
    ]


def obter_doenca_por_slug(slug: str) -> Optional[Dict]:
    return DOENCAS.get(slug)

# ----------------------------------------------------------------------
# Séries e previsões 
# ----------------------------------------------------------------------

def _serie_base(ano_ini: int = 2016, ano_fim: int = 2023, base: int = 100, passo: int = 8) -> List[Dict]:
    """Gera dados originais simples, crescente linear, p/ demo de gráfico."""
    out = []
    valor = base
    for ano in range(ano_ini, ano_fim + 1):
        out.append({"ano": ano, "valor": valor})
        valor += passo
    return out


def _previsao_linear(ultimo_valor: int, anos: int = 3, passo: int = 10, ano_inicio: int = 2024) -> List[Dict]:
    """Gera previsão linear (mock) a partir do último valor observado."""
    out = []
    v = ultimo_valor
    ano = ano_inicio
    for _ in range(anos):
        v += passo
        out.append({"ano": ano, "valor": v})
        ano += 1
    return out


def obter_series(doenca_slug: str, tipo: str, modelo: str) -> Dict:
    """
    Retorna {dados_originais, previsao} FICTÍCIOS.
    - tipo: 'obitos' | 'internacoes' | 'incidencia'
    - modelo: 'arima' | 'auto_arima' | 'holtwinters' (por enquanto ignorado; formato é o mesmo)
    """
    d = DOENCAS.get(doenca_slug)
    if not d:
        raise KeyError("Doença não encontrada")

    if tipo not in d["tipos_de_dado"]:
        raise ValueError(f"Tipo '{tipo}' indisponível para esta doença")

    # Parametriza base/passo por tipo só para variar o gráfico
    if tipo == "obitos":
        base, passo_obs, passo_prev = 120, 9, 11
    elif tipo == "internacoes":
        base, passo_obs, passo_prev = 80, 6, 8
    else:  # incidencia
        base, passo_obs, passo_prev = 60, 5, 6

    originais = _serie_base(base=base, passo=passo_obs)
    previsao = _previsao_linear(ultimo_valor=originais[-1]["valor"], passo=passo_prev)

    return {
        "doenca": d["nome"],
        "tipo": tipo,
        "modelo": modelo.upper(),
        "dados_originais": originais,
        "previsao": previsao,
    }

