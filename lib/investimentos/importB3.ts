/**
 * Leitura do extrato de posicao exportado pela B3 (Portal do Investidor ->
 * Extratos -> Posicao -> Exportar para Excel).
 *
 * O arquivo tem uma aba por tipo de produto (Acoes, BDR, ETF, Fundo de
 * Investimento, Tesouro Direto, Renda Fixa...) e cada aba usa um conjunto
 * diferente de colunas. Em vez de fixar abas e posicoes, procuramos o
 * cabecalho em cada aba e casamos as colunas pelo nome — assim o dia que a
 * B3 acrescentar uma coluna ou uma aba nova, nada quebra.
 *
 * Nada e gravado por conta propria: a tela mostra o que casou, o que ficou
 * ambiguo e o que nao tem par no cadastro antes de qualquer escrita.
 */

const norm = (v: unknown): string =>
  (v ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

/** Normalizacao agressiva para comparar nome de corretora: so letras e digitos. */
const compacto = (v: unknown): string => norm(v).replace(/[^a-z0-9]/g, '')

// Rotulos aceitos por campo, do mais especifico para o mais generico.
const ROTULOS = {
  ticker: ['codigo de negociacao', 'codigo de negociação', 'codigo'],
  produto: ['produto', 'especificacao do ativo', 'nome do fundo', 'nome'],
  instituicao: ['instituicao'],
  quantidade: ['quantidade', 'quantidade disponivel'],
  preco: ['preco de fechamento', 'preco atualizado', 'valor atualizado unitario', 'preco'],
  valor: ['valor atualizado', 'valor bruto atualizado', 'valor liquido', 'valor'],
} as const

type Campo = keyof typeof ROTULOS

export type SituacaoLinha = 'Casado' | 'CorretoraDivergente' | 'Ambiguo' | 'SemPar'

export interface AtivoParaCasar {
  id: string
  ticker: string
  nome: string | null
  corretora_nome: string | null
}

export interface LinhaB3 {
  /** Identificador estavel da linha, para keys de React. */
  chave: string
  aba: string
  identificador: string
  produto: string | null
  instituicao: string | null
  quantidade: number | null
  precoUnitario: number | null
  valor: number
  /** Ativo escolhido: sugerido pelo casamento, editavel na tela. */
  ativoId: string | null
  situacao: SituacaoLinha
  /** Ativos possiveis quando a linha ficou ambigua. */
  candidatos: string[]
  aviso: string | null
}

export interface ResultadoImport {
  linhas: LinhaB3[]
  /** Abas que foram lidas com sucesso. */
  abasLidas: string[]
  /** Abas ignoradas e o motivo. */
  abasIgnoradas: { aba: string; motivo: string }[]
}

/** ExcelJS devolve numero, texto, Date, formula ({result}) ou rich text. */
function valorCelula(cell: { value: unknown }): unknown {
  const v = cell?.value
  if (v == null) return null
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    if ('result' in obj) return obj.result
    if ('text' in obj) return obj.text
    if ('richText' in obj) {
      return (obj.richText as { text: string }[]).map((p) => p.text).join('')
    }
  }
  return v
}

function numero(v: unknown): number | null {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  // A B3 exporta numero como texto em algumas abas: "1.234,56" e "R$ 1.234,56".
  const limpo = v
    .toString()
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/** Acha a linha de cabecalho: a primeira que tem a coluna Instituicao. */
function acharCabecalho(linhas: unknown[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 15); i++) {
    if (linhas[i]?.some((c) => norm(c) === 'instituicao')) return i
  }
  return -1
}

function mapearColunas(cabecalho: unknown[]): Partial<Record<Campo, number>> {
  const normalizado = cabecalho.map((c) => norm(c))
  const mapa: Partial<Record<Campo, number>> = {}

  for (const campo of Object.keys(ROTULOS) as Campo[]) {
    for (const rotulo of ROTULOS[campo]) {
      const i = normalizado.indexOf(norm(rotulo))
      if (i >= 0) {
        mapa[campo] = i
        break
      }
    }
  }

  return mapa
}

/**
 * Casa uma linha do extrato com um ativo do cadastro.
 *
 * 1. ticker (ou nome do produto) + corretora batendo -> casado
 * 2. um unico cadastro com aquele ticker, corretora divergente -> casado com aviso
 * 3. mais de um candidato -> ambiguo, a tela pede a escolha
 */
function casar(
  identificador: string,
  produto: string | null,
  instituicao: string | null,
  ativos: AtivoParaCasar[]
): Pick<LinhaB3, 'ativoId' | 'situacao' | 'candidatos' | 'aviso'> {
  const alvo = norm(identificador)

  let candidatos = ativos.filter((a) => norm(a.ticker) === alvo)

  // Tesouro Direto e Renda Fixa nao tem codigo de negociacao; sobra o nome
  // do produto, comparado com ticker e nome do cadastro.
  if (candidatos.length === 0 && produto) {
    const alvoProduto = norm(produto)
    candidatos = ativos.filter(
      (a) => norm(a.nome) === alvoProduto || norm(a.ticker) === alvoProduto
    )
  }

  if (candidatos.length === 0) {
    return { ativoId: null, situacao: 'SemPar', candidatos: [], aviso: null }
  }

  const instCompacta = compacto(instituicao)
  const daCorretora = candidatos.filter((a) => {
    const c = compacto(a.corretora_nome)
    return c.length > 0 && instCompacta.includes(c)
  })

  if (daCorretora.length === 1) {
    return { ativoId: daCorretora[0].id, situacao: 'Casado', candidatos: [], aviso: null }
  }

  if (daCorretora.length === 0 && candidatos.length === 1) {
    return {
      ativoId: candidatos[0].id,
      situacao: 'CorretoraDivergente',
      candidatos: [],
      aviso: `Extrato diz "${instituicao ?? '-'}", cadastro diz "${candidatos[0].corretora_nome ?? '-'}"`,
    }
  }

  const possiveis = (daCorretora.length > 0 ? daCorretora : candidatos).map((a) => a.id)
  return {
    ativoId: null,
    situacao: 'Ambiguo',
    candidatos: possiveis,
    aviso: `${possiveis.length} cadastros possiveis para este papel`,
  }
}

/**
 * Le o .xlsx da B3 e devolve as linhas ja casadas com o cadastro.
 * O exceljs entra sob demanda para nao pesar o bundle da tela.
 */
export async function lerExtratoB3(
  arquivo: File,
  ativos: AtivoParaCasar[]
): Promise<ResultadoImport> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await arquivo.arrayBuffer())

  const linhas: LinhaB3[] = []
  const abasLidas: string[] = []
  const abasIgnoradas: { aba: string; motivo: string }[] = []

  wb.eachSheet((ws) => {
    const grade: unknown[][] = []
    ws.eachRow({ includeEmpty: false }, (row) => {
      const cells: unknown[] = []
      row.eachCell({ includeEmpty: true }, (cell, col) => {
        cells[col - 1] = valorCelula(cell)
      })
      grade.push(cells)
    })

    const iCabecalho = acharCabecalho(grade)
    if (iCabecalho < 0) {
      abasIgnoradas.push({ aba: ws.name, motivo: 'sem coluna Instituicao' })
      return
    }

    const col = mapearColunas(grade[iCabecalho])
    if (col.valor == null && (col.quantidade == null || col.preco == null)) {
      abasIgnoradas.push({ aba: ws.name, motivo: 'sem coluna de valor' })
      return
    }

    let lidasNaAba = 0

    for (let i = iCabecalho + 1; i < grade.length; i++) {
      const r = grade[i]

      const ticker = col.ticker != null ? (r[col.ticker] ?? '').toString().trim().toUpperCase() : ''
      const produto = col.produto != null ? (r[col.produto] ?? '').toString().trim() : ''
      const identificador = ticker || produto
      // Linha em branco ou rodape de total.
      if (!identificador) continue

      const instituicao = col.instituicao != null ? (r[col.instituicao] ?? '').toString().trim() : ''
      const quantidade = col.quantidade != null ? numero(r[col.quantidade]) : null
      let precoUnitario = col.preco != null ? numero(r[col.preco]) : null
      let valor = col.valor != null ? numero(r[col.valor]) : null

      if (valor == null && quantidade != null && precoUnitario != null) {
        valor = quantidade * precoUnitario
      }
      if (precoUnitario == null && valor != null && quantidade) {
        precoUnitario = valor / quantidade
      }
      if (valor == null) continue

      linhas.push({
        chave: `${ws.name}:${i}:${identificador}`,
        aba: ws.name,
        identificador,
        produto: produto || null,
        instituicao: instituicao || null,
        quantidade,
        precoUnitario,
        valor: Math.round(valor * 100) / 100,
        ...casar(identificador, produto || null, instituicao || null, ativos),
      })
      lidasNaAba++
    }

    if (lidasNaAba > 0) abasLidas.push(ws.name)
    else abasIgnoradas.push({ aba: ws.name, motivo: 'nenhuma linha com valor' })
  })

  return { linhas, abasLidas, abasIgnoradas }
}
