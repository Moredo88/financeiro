/**
 * Rating de credito por papel de renda fixa.
 *
 * Nao existe campo de rating no cadastro de ativos (verificado em
 * 2026-09-15: a tabela `ativos` nao tem essa coluna), entao este mapa e
 * mantido a mao, no mesmo espirito de `setores.ts`: papel fora do mapa
 * aparece como "Sem rating informado" no relatorio — nunca um palpite.
 *
 * Os ratings abaixo foram informados pelo dono da carteira em 2026-09-15,
 * por EMISSOR; aqui eles estao amarrados ao ticker de cada papel, que e o
 * que o relatorio enxerga. Quando um emissor tem rating em escala nacional
 * (brAAA, AAA(bra), AA-.br) e tambem em escala global (BB+, Baa3), o
 * agrupamento usa a escala NACIONAL — ela e relativa ao risco soberano
 * brasileiro e e a leitura util para comparar papeis locais entre si.
 *
 * Papeis da carteira ainda sem rating informado (aparecem como "Sem rating
 * informado" ate serem preenchidos aqui):
 *   24D3313888  CRI CURY (pos-fixado)  — o rating informado era da serie E309 S3
 *   25K3382735  BG PRIME LOG (CRI)
 *   CRA024001Q9 ZAMP
 *   CRA0250012Y FS FLORESTAL — mesmo grupo do FS-BIO, mas emissao diferente
 *   6387425UN1  RBR INFRA (FIP)
 *   6261925UN1  RBR VALORA (FIP)
 *   26F0010482  CRI IGUATEMI
 *   BTG-FIRF    fundo de renda fixa (carteira pulverizada, sem rating unico)
 */

export interface RatingCadastrado {
  /** Emissor/grupo economico, como o dono da carteira o chama. */
  emissor: string
  /** Rating verbatim, como informado — nunca reescrito pelo relatorio. */
  texto: string
  agencia: string
  /** Letra na escala nacional brasileira, quando houver. */
  nacional: string | null
  /** Letra na escala global, quando houver. */
  global: string | null
}

export const RATING_PAPEL: Record<string, RatingCadastrado> = {
  // --- Escala nacional AAA
  PEJA13: { emissor: 'PRIO Forte', texto: 'brAAA / AAA(bra)', agencia: 'S&P / Fitch', nacional: 'AAA', global: null },
  'E309 S3': { emissor: 'CRI Cury (E309 S3)', texto: 'brAAA / AAA.br', agencia: 'S&P / Moody’s', nacional: 'AAA', global: null },
  BTEL23: { emissor: 'V.TAL', texto: 'brAAA (Est.)', agencia: 'Escala local', nacional: 'AAA', global: null },
  BTEL33: { emissor: 'V.TAL', texto: 'brAAA (Est.)', agencia: 'Escala local', nacional: 'AAA', global: null },
  CRA022007EP: { emissor: 'Klabin', texto: 'BB+ ; AAA(bra)', agencia: 'Fitch', nacional: 'AAA', global: 'BB+' },
  CRA02500BVU: { emissor: 'MBRF (BRF + Marfrig)', texto: 'BB+ / AAA(bra)', agencia: 'Fitch / S&P', nacional: 'AAA', global: 'BB+' },

  // --- Escala nacional AA
  CRA025000RT: { emissor: 'Eucatex', texto: 'brAA (Est.)', agencia: 'Escala local', nacional: 'AA', global: null },
  CRA025009VO: { emissor: 'Eucatex', texto: 'brAA (Est.)', agencia: 'Escala local', nacional: 'AA', global: null },
  '5871324FII': { emissor: 'Mauá Capital', texto: 'brAA (Est.)', agencia: 'Escala local', nacional: 'AA', global: null },
  CRA02500001: { emissor: 'Boa Safra', texto: 'brAA- (Est.)', agencia: 'Escala local', nacional: 'AA-', global: null },
  CRA022004SD: { emissor: 'FS-BIO', texto: 'BB- / AA-.br', agencia: 'Fitch / Moody’s', nacional: 'AA-', global: 'BB-' },
  CRA0250012X: { emissor: 'FS-BIO', texto: 'BB- / AA-.br', agencia: 'Fitch / Moody’s', nacional: 'AA-', global: 'BB-' },
  CRA02300S37: { emissor: 'FS-BIO', texto: 'BB- / AA-.br', agencia: 'Fitch / Moody’s', nacional: 'AA-', global: 'BB-' },

  // --- Escala nacional A
  CRA026001JL: { emissor: 'CRA Lar Cooperativa', texto: 'A(bra)', agencia: 'Fitch', nacional: 'A', global: null },
  // "JOTA ELE" e como a JL Construtora entrou no cadastro — casamento por nome.
  '24K1807630': { emissor: 'JL Construtora', texto: 'brA+ (Est.)', agencia: 'Escala local', nacional: 'A+', global: null },

  // --- Escala nacional BBB
  CRA02100130: { emissor: 'Grupo José Alves', texto: 'brBBB+', agencia: 'S&P', nacional: 'BBB+', global: null },

  // --- Só escala global
  CRA025000MF: { emissor: 'JBS / Seara', texto: 'BBB- / Baa3', agencia: 'Fitch / Moody’s', nacional: null, global: 'BBB-' },
  ENAT13: { emissor: 'Brava Energia', texto: 'BB (perspectiva positiva)', agencia: 'Fitch', nacional: null, global: 'BB' },
  CRA025005V6: { emissor: 'Minerva', texto: 'BB', agencia: 'Fitch', nacional: null, global: 'BB' },
  CRA025007KK: { emissor: 'Eldorado', texto: 'BB / Ba3', agencia: 'Fitch / Moody’s', nacional: null, global: 'BB' },
  CRA024006Y2: { emissor: 'Adecoagro', texto: 'BB- / B2', agencia: 'S&P / Moody’s', nacional: null, global: 'BB-' },
}

export type EscalaRating = 'soberano' | 'nacional' | 'global' | 'fgc' | 'nao_informado'

export interface RatingPapel {
  emissor: string | null
  /** Rating verbatim (ou a razao de nao haver um). */
  texto: string
  agencia: string | null
  /** Bucket usado na tabela de concentracao por rating. */
  grupo: string
  escala: EscalaRating
}

/** Categorias cobertas pelo FGC — mesma lista usada no alerta de teto do FGC. */
const CATEGORIAS_FGC = new Set(['CDB', 'LCA', 'LCI', 'LCD', 'LC', 'RDB', 'LIG'])

export const GRUPO_SOBERANO = 'Soberano (Tesouro Nacional)'
export const GRUPO_FGC = 'Garantia do FGC (banco emissor)'
export const GRUPO_SEM_RATING = 'Sem rating informado'

/** Do mais seguro para o mais arriscado — ordem das linhas na tabela por rating. */
export const ORDEM_GRUPOS_RATING = [
  GRUPO_SOBERANO,
  GRUPO_FGC,
  'AAA — escala nacional',
  'AA — escala nacional',
  'A — escala nacional',
  'BBB — escala nacional',
  'BB ou abaixo — escala nacional',
  'Grau de investimento — escala global',
  'Alto rendimento — escala global',
  GRUPO_SEM_RATING,
]

/** "brAA- (Est.)" -> "AA"; "AAA(bra)" -> "AAA"; "Baa3" -> "BAA". */
function familiaDeLetras(nota: string): string {
  const limpo = nota
    .trim()
    .replace(/\(est\.?\)/gi, '')
    .replace(/\(bra\)|\.br$/gi, '')
    .replace(/^br/i, '')
    .trim()
  const letras = limpo.match(/^[A-Da-d]+/)
  return letras ? letras[0].toUpperCase() : ''
}

/** Escala global: BBB- e acima e grau de investimento. */
const GRAU_INVESTIMENTO_GLOBAL = new Set(['AAA', 'AA', 'A', 'BBB', 'BAA'])

function grupoNacional(nota: string): string {
  const f = familiaDeLetras(nota)
  if (f === 'AAA') return 'AAA — escala nacional'
  if (f === 'AA') return 'AA — escala nacional'
  if (f === 'A') return 'A — escala nacional'
  if (f === 'BBB') return 'BBB — escala nacional'
  return 'BB ou abaixo — escala nacional'
}

function grupoGlobal(nota: string): string {
  return GRAU_INVESTIMENTO_GLOBAL.has(familiaDeLetras(nota))
    ? 'Grau de investimento — escala global'
    : 'Alto rendimento — escala global'
}

/**
 * Rating de um papel, na ordem: soberano, rating cadastrado, cobertura do
 * FGC, sem informacao. Nunca deduz um rating a partir da taxa ou do prazo.
 */
export function ratingDaPosicao(p: {
  ticker: string | null
  classe: string | null
  categoria: string | null
}): RatingPapel {
  if ((p.classe ?? '').trim().toUpperCase() === 'TESOURO DIRETO') {
    return {
      emissor: 'Tesouro Nacional',
      texto: 'Risco soberano',
      agencia: null,
      grupo: GRUPO_SOBERANO,
      escala: 'soberano',
    }
  }

  const chave = (p.ticker ?? '').trim().toUpperCase()
  const cadastrado = RATING_PAPEL[chave]
  if (cadastrado) {
    return {
      emissor: cadastrado.emissor,
      texto: cadastrado.texto,
      agencia: cadastrado.agencia,
      grupo: cadastrado.nacional
        ? grupoNacional(cadastrado.nacional)
        : cadastrado.global
          ? grupoGlobal(cadastrado.global)
          : GRUPO_SEM_RATING,
      escala: cadastrado.nacional ? 'nacional' : cadastrado.global ? 'global' : 'nao_informado',
    }
  }

  if (p.categoria && CATEGORIAS_FGC.has(p.categoria.trim().toUpperCase())) {
    return {
      emissor: null,
      texto: 'Sem rating — coberto pelo FGC até o teto',
      agencia: null,
      grupo: GRUPO_FGC,
      escala: 'fgc',
    }
  }

  return { emissor: null, texto: '—', agencia: null, grupo: GRUPO_SEM_RATING, escala: 'nao_informado' }
}
