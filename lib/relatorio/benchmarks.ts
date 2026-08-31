import Anthropic from '@anthropic-ai/sdk'

/** Selic meta, CDI, IPCA acumulado 12 meses, dolar PTAX — series publicas do SGS/BCB, sem chave. */
const SERIES_BCB = {
  selicMeta: 432,
  cdi: 12,
  ipca12m: 13522,
  dolarPtax: 1,
} as const

export interface BenchmarksBCB {
  selicMeta: number | null
  cdi: number | null
  ipca12m: number | null
  dolarPtax: number | null
  falhas: string[]
}

interface SgsPonto {
  data: string
  valor: string
}

/**
 * Busca o valor mais recente de cada serie do SGS/BCB. Cada serie falha
 * independente — uma indisponivel nunca derruba as outras — e o relatorio
 * sinaliza "nao disponivel" para a que faltar, nunca inventa um numero.
 * Mesma postura de falha parcial de lib/investimentos/atualizarCotacoes.ts.
 */
export async function buscarBenchmarksBCB(): Promise<BenchmarksBCB> {
  const falhas: string[] = []

  async function buscarSerie(nome: string, codigo: number): Promise<number | null> {
    try {
      const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados/ultimos/1?formato=json`
      const res = await fetch(url)
      if (!res.ok) {
        falhas.push(`${nome} (HTTP ${res.status})`)
        return null
      }
      const pontos: SgsPonto[] = await res.json()
      const valor = pontos[0]?.valor
      if (valor == null) {
        falhas.push(`${nome} (sem dado retornado)`)
        return null
      }
      const numero = Number(valor.replace(',', '.'))
      return Number.isFinite(numero) ? numero : null
    } catch (e) {
      falhas.push(`${nome} (${e instanceof Error ? e.message : 'erro desconhecido'})`)
      return null
    }
  }

  const [selicMeta, cdi, ipca12m, dolarPtax] = await Promise.all([
    buscarSerie('Selic meta', SERIES_BCB.selicMeta),
    buscarSerie('CDI', SERIES_BCB.cdi),
    buscarSerie('IPCA 12 meses', SERIES_BCB.ipca12m),
    buscarSerie('Dólar PTAX', SERIES_BCB.dolarPtax),
  ])

  return { selicMeta, cdi, ipca12m, dolarPtax, falhas }
}

export interface BenchmarksMercado {
  ibovespaVar12m: number | null
  ifixVar12m: number | null
  tesouroIpcaTaxa: number | null
  tesouroPreTaxa: number | null
  fontes: string[]
}

const SCHEMA_BENCHMARKS_MERCADO = {
  type: 'object' as const,
  properties: {
    ibovespaVar12m: { type: ['number', 'null'], description: 'Variação percentual do Ibovespa nos últimos 12 meses.' },
    ifixVar12m: { type: ['number', 'null'], description: 'Variação percentual do IFIX nos últimos 12 meses.' },
    tesouroIpcaTaxa: {
      type: ['number', 'null'],
      description: 'Taxa real (% a.a.) do Tesouro IPCA+ de vencimento mais longo disponível, sem o "IPCA+".',
    },
    tesouroPreTaxa: {
      type: ['number', 'null'],
      description: 'Taxa nominal (% a.a.) do Tesouro Prefixado de vencimento mais longo disponível.',
    },
    fontes: {
      type: 'array',
      items: { type: 'string' },
      description: 'URLs das páginas usadas para obter os quatro números acima.',
    },
  },
  required: ['ibovespaVar12m', 'ifixVar12m', 'tesouroIpcaTaxa', 'tesouroPreTaxa', 'fontes'],
}

/**
 * Pesquisa na web os quatro benchmarks sem fonte gratuita automatizavel no
 * app (Ibovespa, IFIX, Tesouro IPCA+, Tesouro Prefixado). Chamada isolada e
 * pequena — so estes 4 numeros, nunca a narrativa do relatorio inteiro —
 * para manter o escopo (e o custo) da tool de busca contido.
 */
export async function buscarBenchmarksMercadoViaIA(competencia: string): Promise<BenchmarksMercado> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada no servidor.')
  }

  // tool_choice nao pode forcar "entregar_benchmarks" desde o primeiro turno:
  // isso impediria a IA de usar a web_search antes. Deixamos "auto" para ela
  // pesquisar primeiro (a busca e uma tool de servidor, executada dentro da
  // mesma chamada) e so entao chamar a tool de entrega. Uma busca longa pode
  // parar com stop_reason "pause_turn" pedindo continuacao — o laço abaixo
  // reenvia a conversa ate 3 vezes antes de desistir, mesmo espirito do laço
  // de iteracoes de app/api/assistente/route.ts.
  const client = new Anthropic()
  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `Preciso, para o mês de referência ${competencia}: variação do Ibovespa em 12 meses, variação do IFIX em 12 meses, taxa atual do Tesouro IPCA+ de vencimento mais longo, e taxa atual do Tesouro Prefixado de vencimento mais longo.`,
    },
  ]

  for (let i = 0; i < 3; i++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      system:
        'Você pesquisa dados de mercado brasileiros atuais. Pesquise na web e, ao final, responda ' +
        'SEMPRE chamando a ferramenta "entregar_benchmarks" — nunca em texto livre. ' +
        'Use fontes primárias ou agregadores confiáveis (Status Invest, InfoMoney, B3, Tesouro Direto, Banco Central). ' +
        'Se não encontrar um número com confiança, devolva null nele — nunca estime ou invente.',
      messages,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', max_uses: 8 },
        {
          name: 'entregar_benchmarks',
          description: 'Entrega os quatro benchmarks pesquisados. Chame só depois de pesquisar.',
          input_schema: SCHEMA_BENCHMARKS_MERCADO,
        },
      ],
      tool_choice: { type: 'auto' },
    })

    const toolUse = response.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'entregar_benchmarks'
    )
    if (toolUse) return toolUse.input as BenchmarksMercado

    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content })
      continue
    }

    break
  }

  throw new Error('A IA não devolveu os benchmarks no formato esperado. Tente de novo ou use o modo manual.')
}
