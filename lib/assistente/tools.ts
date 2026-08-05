import type Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularPosicoes, type AtivoCalc, type MovimentacaoCalc } from '@/lib/investimentos/posicao'

/**
 * Ferramentas que o assistente pode chamar para consultar os dados do usuario.
 * Todas as consultas usam o client autenticado do usuario, entao a RLS do
 * Supabase garante que o assistente so enxerga o que o proprio usuario enxerga.
 */
export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'listar_opcoes_cadastro',
    description:
      'Lista os valores validos de Categorias, Classes, Contas e Frequencias dos lancamentos, ' +
      'e as Classes de Ativo, Carteiras e Estrategias dos investimentos. ' +
      'Chame esta ferramenta antes de filtrar por qualquer um desses campos, para usar o nome exato cadastrado.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'consultar_lancamentos',
    description:
      'Consulta os lancamentos financeiros (despesas e receitas) do usuario. ' +
      'Retorna o total, a quantidade, o resumo agrupado por categoria/classe/conta/mes, ' +
      'e uma amostra dos lancamentos individuais. Use os filtros para responder perguntas ' +
      'como "quanto gastei com Mercado em 2026" ou "quais os maiores lancamentos do mes".',
    input_schema: {
      type: 'object',
      properties: {
        data_inicio: { type: 'string', description: 'Data inicial no formato AAAA-MM-DD' },
        data_fim: { type: 'string', description: 'Data final no formato AAAA-MM-DD' },
        categoria: { type: 'string', description: 'Nome exato da categoria (ex: Mercado)' },
        classe: { type: 'string', description: 'Nome exato da classe (ex: Sergio)' },
        conta: { type: 'string', description: 'Nome exato da conta (ex: BTG-C)' },
        status: { type: 'string', enum: ['R', 'P'], description: 'R = Realizado, P = Previsto' },
        busca_descricao: { type: 'string', description: 'Texto a procurar na descricao do lancamento' },
      },
      required: [],
    },
  },
  {
    name: 'consultar_investimentos',
    description:
      'Retorna a posicao atual da carteira de investimentos: por ativo traz quantidade, preco medio, ' +
      'valor investido, valor de mercado, proventos recebidos e rentabilidade. ' +
      'Tambem traz o patrimonio total e a distribuicao por classe de ativo.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

const MAX_LINHAS_AMOSTRA = 40

function somar(mapa: Map<string, { total: number; qtd: number }>, chave: string, valor: number) {
  const atual = mapa.get(chave) ?? { total: 0, qtd: 0 }
  mapa.set(chave, { total: atual.total + valor, qtd: atual.qtd + 1 })
}

function ordenarPorTotal(mapa: Map<string, { total: number; qtd: number }>) {
  return Object.fromEntries(
    Array.from(mapa.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .map(([nome, v]) => [nome, { total: Math.round(v.total * 100) / 100, quantidade: v.qtd }])
  )
}

async function listarOpcoesCadastro(supabase: SupabaseClient) {
  const [cat, cls, ctas, freq, clAtivo, carteiras, estrategias] = await Promise.all([
    supabase.from('categorias').select('nome').eq('ativo', true).order('nome'),
    supabase.from('classes').select('nome').eq('ativo', true).order('nome'),
    supabase.from('contas').select('nome').eq('ativo', true).order('nome'),
    supabase.from('frequencias').select('nome').eq('ativo', true).order('nome'),
    supabase.from('classes_ativo').select('nome').eq('ativo', true).order('nome'),
    supabase.from('carteiras').select('nome').eq('ativo', true).order('nome'),
    supabase.from('estrategias').select('nome').eq('ativo', true).order('nome'),
  ])

  const nomes = (r: { data: { nome: string }[] | null }) => (r.data ?? []).map((x) => x.nome)

  return {
    lancamentos: {
      categorias: nomes(cat),
      classes: nomes(cls),
      contas: nomes(ctas),
      frequencias: nomes(freq),
    },
    investimentos: {
      classes_ativo: nomes(clAtivo),
      carteiras: nomes(carteiras),
      estrategias: nomes(estrategias),
    },
  }
}

interface FiltrosLancamento {
  data_inicio?: string
  data_fim?: string
  categoria?: string
  classe?: string
  conta?: string
  status?: string
  busca_descricao?: string
}

interface LancamentoRow {
  data: string
  valor: number
  descricao: string | null
  status: string
  categorias: { nome: string } | null
  classes: { nome: string } | null
  contas: { nome: string } | null
  frequencias: { nome: string } | null
}

async function consultarLancamentos(supabase: SupabaseClient, filtros: FiltrosLancamento) {
  let query = supabase
    .from('lancamentos')
    .select('data, valor, descricao, status, categorias(nome), classes(nome), contas(nome), frequencias(nome)')
    .order('data', { ascending: false })

  if (filtros.data_inicio) query = query.gte('data', filtros.data_inicio)
  if (filtros.data_fim) query = query.lte('data', filtros.data_fim)
  if (filtros.status) query = query.eq('status', filtros.status)
  if (filtros.busca_descricao) query = query.ilike('descricao', `%${filtros.busca_descricao}%`)

  const { data, error } = await query
  if (error) return { erro: error.message }

  // Filtros por nome sao aplicados aqui porque o join impede o .eq() direto.
  let linhas = (data as unknown as LancamentoRow[]) ?? []
  const igual = (a: string | undefined | null, b: string | undefined) =>
    !b || (a ?? '').toLowerCase() === b.toLowerCase()

  linhas = linhas.filter(
    (l) =>
      igual(l.categorias?.nome, filtros.categoria) &&
      igual(l.classes?.nome, filtros.classe) &&
      igual(l.contas?.nome, filtros.conta)
  )

  const porCategoria = new Map<string, { total: number; qtd: number }>()
  const porClasse = new Map<string, { total: number; qtd: number }>()
  const porConta = new Map<string, { total: number; qtd: number }>()
  const porMes = new Map<string, { total: number; qtd: number }>()
  let total = 0

  for (const l of linhas) {
    total += l.valor
    somar(porCategoria, l.categorias?.nome ?? 'Sem categoria', l.valor)
    somar(porClasse, l.classes?.nome ?? 'Sem classe', l.valor)
    somar(porConta, l.contas?.nome ?? 'Sem conta', l.valor)
    somar(porMes, l.data.slice(0, 7), l.valor)
  }

  return {
    quantidade: linhas.length,
    valor_total: Math.round(total * 100) / 100,
    por_categoria: ordenarPorTotal(porCategoria),
    por_classe: ordenarPorTotal(porClasse),
    por_conta: ordenarPorTotal(porConta),
    por_mes: Object.fromEntries(
      Array.from(porMes.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([mes, v]) => [mes, Math.round(v.total * 100) / 100])
    ),
    amostra_maiores_lancamentos: [...linhas]
      .sort((a, b) => b.valor - a.valor)
      .slice(0, MAX_LINHAS_AMOSTRA)
      .map((l) => ({
        data: l.data,
        valor: l.valor,
        descricao: l.descricao,
        categoria: l.categorias?.nome,
        classe: l.classes?.nome,
        conta: l.contas?.nome,
        status: l.status === 'R' ? 'Realizado' : 'Previsto',
      })),
    observacao:
      linhas.length > MAX_LINHAS_AMOSTRA
        ? `A amostra traz os ${MAX_LINHAS_AMOSTRA} maiores lancamentos; os totais e agrupamentos consideram todos os ${linhas.length}.`
        : undefined,
  }
}

interface AtivoRow {
  id: string
  ticker: string
  nome: string | null
  status: string
  cotacao_atual: number | null
  saldo_devedor: number | null
  taxa: number | null
  data_vencimento: string | null
  indexador: string | null
  amortizacao: string | null
  juros: string | null
  classes_ativo: { nome: string } | null
  carteiras: { nome: string } | null
  estrategias: { nome: string } | null
}

async function consultarInvestimentos(supabase: SupabaseClient) {
  const [ativosRes, movRes] = await Promise.all([
    supabase
      .from('ativos')
      .select(
        'id, ticker, nome, status, cotacao_atual, saldo_devedor, taxa, data_vencimento, indexador, amortizacao, juros, classes_ativo(nome), carteiras(nome), estrategias(nome)'
      ),
    supabase.from('movimentacoes_ativos').select('ativo_id, tipo_evento, quantidade, valor_liquido'),
  ])

  if (ativosRes.error) return { erro: ativosRes.error.message }

  const ativos = (ativosRes.data as unknown as AtivoRow[]) ?? []
  const movimentacoes = (movRes.data as MovimentacaoCalc[]) ?? []

  if (ativos.length === 0) {
    return { aviso: 'Nenhum ativo cadastrado na carteira de investimentos.' }
  }

  const ativosCalc: AtivoCalc[] = ativos.map((a) => ({
    id: a.id,
    classe_nome: a.classes_ativo?.nome ?? null,
    cotacao_atual: a.cotacao_atual,
    saldo_devedor: a.saldo_devedor,
  }))
  const posicoes = calcularPosicoes(ativosCalc, movimentacoes)

  const abertas = ativos
    .map((a) => ({ ativo: a, pos: posicoes.get(a.id)! }))
    .filter((p) => p.pos && Math.abs(p.pos.quantidade) > 0.0000001)

  const patrimonio = abertas.reduce((s, p) => s + p.pos.valorMercado, 0)
  const investido = abertas.reduce((s, p) => s + p.pos.valorInvestido, 0)
  const proventos = Array.from(posicoes.values()).reduce((s, p) => s + p.proventos, 0)

  const porClasse = new Map<string, { total: number; qtd: number }>()
  abertas.forEach((p) => somar(porClasse, p.ativo.classes_ativo?.nome ?? 'Sem classe', p.pos.valorMercado))

  const semCotacao = abertas.filter(
    (p) => p.ativo.cotacao_atual == null && p.ativo.saldo_devedor == null
  ).length

  return {
    patrimonio_total: Math.round(patrimonio * 100) / 100,
    valor_investido_total: Math.round(investido * 100) / 100,
    proventos_recebidos_total: Math.round(proventos * 100) / 100,
    rentabilidade_total_percentual:
      investido > 0 ? Math.round(((patrimonio + proventos - investido) / investido) * 10000) / 100 : 0,
    patrimonio_por_classe: ordenarPorTotal(porClasse),
    posicoes: abertas
      .sort((a, b) => b.pos.valorMercado - a.pos.valorMercado)
      .map((p) => ({
        ticker: p.ativo.ticker,
        nome: p.ativo.nome,
        classe: p.ativo.classes_ativo?.nome,
        carteira: p.ativo.carteiras?.nome,
        estrategia: p.ativo.estrategias?.nome,
        status: p.ativo.status,
        quantidade: p.pos.quantidade,
        preco_medio: Math.round(p.pos.precoMedio * 10000) / 10000,
        valor_investido: Math.round(p.pos.valorInvestido * 100) / 100,
        valor_mercado: Math.round(p.pos.valorMercado * 100) / 100,
        proventos: Math.round(p.pos.proventos * 100) / 100,
        rentabilidade_percentual: Math.round(p.pos.rentabilidade * 10000) / 100,
        taxa_percentual: p.ativo.taxa,
        data_vencimento: p.ativo.data_vencimento,
        indexador: p.ativo.indexador,
        amortizacao: p.ativo.amortizacao,
        juros: p.ativo.juros,
      })),
    aviso_cotacao:
      semCotacao > 0
        ? `${semCotacao} ativo(s) estao sem cotacao atualizada; para eles o valor de mercado usa o preco medio como aproximacao.`
        : undefined,
  }
}

export async function executarFerramenta(
  supabase: SupabaseClient,
  nome: string,
  input: unknown
): Promise<unknown> {
  switch (nome) {
    case 'listar_opcoes_cadastro':
      return listarOpcoesCadastro(supabase)
    case 'consultar_lancamentos':
      return consultarLancamentos(supabase, (input ?? {}) as FiltrosLancamento)
    case 'consultar_investimentos':
      return consultarInvestimentos(supabase)
    default:
      return { erro: `Ferramenta desconhecida: ${nome}` }
  }
}
