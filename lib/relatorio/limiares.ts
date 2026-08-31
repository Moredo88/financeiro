/**
 * Limiar de indiferenca fiscal e veredito por papel de renda fixa.
 *
 * Toda a aritmetica financeira do relatorio mora aqui, em funcoes puras e
 * testaveis — nunca dentro do prompt da IA. Isso existe por causa de um
 * erro real: numa conversa anterior, ao comparar uma LCD contra o Tesouro
 * Selic "na mao" dentro do texto, esqueci a custodia da B3 e troquei
 * pontos de %CDI por pontos de retorno — o usuario so percebeu porque leu
 * com atencao. Aqui essa conta so acontece uma vez, em codigo, e o mesmo
 * resultado alimenta tanto a tabela quanto o texto que a IA escreve.
 *
 * Premissas assumidas (documentadas tambem no relatorio, secao de riscos):
 * - IR de 15% (prazo > 720 dias) para papeis tributados e para o Tesouro.
 * - Custodia B3 de 0,20% a.a. sobre titulos publicos.
 * - Debentures incentivadas e CRA/CRI/LCA/LCI/LCD sao isentos; CDB e
 *   tributado (ver CATEGORIAS_TRIBUTADAS).
 */

export const ALIQUOTA_IR_PREMISSA = 0.15
export const CUSTODIA_B3_PREMISSA = 0.002 // 0,20% a.a.
export const CATEGORIAS_TRIBUTADAS = new Set(['CDB'])

export interface BenchmarksEntrada {
  selicMeta: number | null // % a.a.
  cdi: number | null // % a.a.
  ipca12m: number | null // % em 12 meses
  tesouroIpcaTaxa: number | null // taxa real do titulo, % a.a. (ex.: 7,82)
  tesouroPreTaxa: number | null // taxa nominal do titulo, % a.a.
}

export interface Limiares {
  limiarIpcaIsento: number | null
  limiarPreIsento: number | null
  tesouroSelicLiquido: number | null
}

/**
 * Deriva os tres limiares de indiferenca a partir dos benchmarks do mes.
 * Qualquer benchmark ausente propaga null no limiar correspondente — nunca
 * inventa um valor para preencher a lacuna.
 */
export function calcularLimiares(b: BenchmarksEntrada): Limiares {
  let limiarIpcaIsento: number | null = null
  if (b.ipca12m != null && b.tesouroIpcaTaxa != null) {
    const ipca = b.ipca12m / 100
    const taxaReal = b.tesouroIpcaTaxa / 100
    // Nominal composto do titulo publico, liquido de IR e custodia.
    const nominalBruto = (1 + ipca) * (1 + taxaReal) - 1
    const nominalLiquido = nominalBruto * (1 - ALIQUOTA_IR_PREMISSA) - CUSTODIA_B3_PREMISSA
    // "IPCA + X% isento" cujo nominal composto empata com nominalLiquido.
    const xReal = (1 + nominalLiquido) / (1 + ipca) - 1
    limiarIpcaIsento = xReal * 100
  }

  let limiarPreIsento: number | null = null
  if (b.tesouroPreTaxa != null) {
    limiarPreIsento = b.tesouroPreTaxa * (1 - ALIQUOTA_IR_PREMISSA) - CUSTODIA_B3_PREMISSA * 100
  }

  let tesouroSelicLiquido: number | null = null
  if (b.selicMeta != null) {
    tesouroSelicLiquido = b.selicMeta * (1 - ALIQUOTA_IR_PREMISSA) - CUSTODIA_B3_PREMISSA * 100
  }

  return { limiarIpcaIsento, limiarPreIsento, tesouroSelicLiquido }
}

export interface AtivoRendaFixaEntrada {
  categoria: string | null
  indexador: string | null
  taxa: number | null
}

export interface VeredictoRendaFixaResultado {
  veredicto: 'manter' | 'avaliar' | 'reduzir' | 'nao_avaliavel'
  /** Pontos percentuais de RETORNO ao ano — nunca pontos de %CDI. */
  premioPontosPercentuais: number | null
  equivalentePctCdi: number | null
  limiarUsado: string
  motivo: string
  /** true quando a taxa cadastrada esta perto do limite da heuristica CDI+/%CDI e merece conferencia. */
  taxaAmbigua: boolean
}

const ZONA_AMBIGUA_CDI: [number, number] = [20, 60]
const LIMITE_CDI_PLUS_VS_PCT = 50

/**
 * Classifica um papel de renda fixa contra os limiares do mes.
 *
 * O ponto de corte entre "CDI + X%" e "X% do CDI" e uma heuristica: o
 * cadastro guarda os dois formatos no mesmo campo numerico `taxa`, sem sinalizar
 * qual e qual. Na carteira observada os dois grupos ficam bem separados
 * (spreads ate ~12, percentuais do CDI a partir de ~82), entao um corte em
 * 50 funciona — mas fica marcado como ambiguo perto da fronteira.
 */
export function classificarRendaFixa(
  ativo: AtivoRendaFixaEntrada,
  limiares: Limiares,
  cdi: number | null
): VeredictoRendaFixaResultado {
  const indexador = (ativo.indexador ?? '').toUpperCase()
  const tributado = CATEGORIAS_TRIBUTADAS.has((ativo.categoria ?? '').toUpperCase())

  if (ativo.taxa == null || !ativo.indexador) {
    return {
      veredicto: 'nao_avaliavel',
      premioPontosPercentuais: null,
      equivalentePctCdi: null,
      limiarUsado: 'sem dado suficiente',
      motivo: 'Indexador ou taxa não cadastrados.',
      taxaAmbigua: false,
    }
  }

  if (indexador.includes('IPCA')) {
    if (limiares.limiarIpcaIsento == null) {
      return {
        veredicto: 'nao_avaliavel',
        premioPontosPercentuais: null,
        equivalentePctCdi: null,
        limiarUsado: 'IPCA+ — benchmark indisponível',
        motivo: 'Taxa do Tesouro IPCA+ ou IPCA 12m não disponíveis neste mês.',
        taxaAmbigua: false,
      }
    }
    const taxaComparavel = tributado ? ativo.taxa * (1 - ALIQUOTA_IR_PREMISSA) : ativo.taxa
    const premio = taxaComparavel - limiares.limiarIpcaIsento
    return {
      veredicto: veredictoPorPremio(premio),
      premioPontosPercentuais: round2(premio),
      equivalentePctCdi: null,
      limiarUsado: `IPCA+${round2(limiares.limiarIpcaIsento)}%`,
      motivo: `Taxa contratada IPCA+${ativo.taxa}% ${tributado ? '(tributado)' : '(isento)'} vs. limiar IPCA+${round2(limiares.limiarIpcaIsento)}%.`,
      taxaAmbigua: false,
    }
  }

  if (indexador.includes('PRÉ') || indexador.includes('PRE-FIX') || indexador.includes('PREFIX')) {
    if (limiares.limiarPreIsento == null) {
      return {
        veredicto: 'nao_avaliavel',
        premioPontosPercentuais: null,
        equivalentePctCdi: null,
        limiarUsado: 'Prefixado — benchmark indisponível',
        motivo: 'Taxa do Tesouro Prefixado não disponível neste mês.',
        taxaAmbigua: false,
      }
    }
    const taxaComparavel = tributado ? ativo.taxa * (1 - ALIQUOTA_IR_PREMISSA) : ativo.taxa
    const premio = taxaComparavel - limiares.limiarPreIsento
    return {
      veredicto: veredictoPorPremio(premio),
      premioPontosPercentuais: round2(premio),
      equivalentePctCdi: null,
      limiarUsado: `${round2(limiares.limiarPreIsento)}% a.a. prefixado`,
      motivo: `Taxa contratada ${ativo.taxa}% ${tributado ? '(tributado)' : '(isento)'} vs. limiar ${round2(limiares.limiarPreIsento)}%.`,
      taxaAmbigua: false,
    }
  }

  if (indexador.includes('CDI')) {
    if (limiares.tesouroSelicLiquido == null || cdi == null) {
      return {
        veredicto: 'nao_avaliavel',
        premioPontosPercentuais: null,
        equivalentePctCdi: null,
        limiarUsado: 'CDI — benchmark indisponível',
        motivo: 'Selic ou CDI não disponíveis neste mês.',
        taxaAmbigua: false,
      }
    }

    const ambigua = ativo.taxa >= ZONA_AMBIGUA_CDI[0] && ativo.taxa <= ZONA_AMBIGUA_CDI[1]
    const brutoAnual = ativo.taxa < LIMITE_CDI_PLUS_VS_PCT ? cdi + ativo.taxa : (cdi * ativo.taxa) / 100
    const liquido = tributado ? brutoAnual * (1 - ALIQUOTA_IR_PREMISSA) : brutoAnual
    const premio = liquido - limiares.tesouroSelicLiquido
    const equivalentePctCdi = cdi > 0 ? (liquido / cdi) * 100 : null

    return {
      veredicto: veredictoPorPremio(premio),
      premioPontosPercentuais: round2(premio),
      equivalentePctCdi: equivalentePctCdi != null ? round1(equivalentePctCdi) : null,
      limiarUsado: `Tesouro Selic líquido (${round2(limiares.tesouroSelicLiquido)}% a.a.)`,
      motivo:
        ativo.taxa < LIMITE_CDI_PLUS_VS_PCT
          ? `Taxa contratada CDI+${ativo.taxa}% ${tributado ? '(tributado)' : '(isento)'}.`
          : `Taxa contratada ${ativo.taxa}% do CDI ${tributado ? '(tributado)' : '(isento)'}.`,
      taxaAmbigua: ambigua,
    }
  }

  return {
    veredicto: 'nao_avaliavel',
    premioPontosPercentuais: null,
    equivalentePctCdi: null,
    limiarUsado: 'indexador não reconhecido',
    motivo: `Indexador "${ativo.indexador}" não tem regra de comparação.`,
    taxaAmbigua: false,
  }
}

function veredictoPorPremio(premio: number): 'manter' | 'avaliar' | 'reduzir' {
  if (premio >= 1) return 'manter'
  if (premio >= 0) return 'avaliar'
  return 'reduzir'
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
function round1(n: number): number {
  return Math.round(n * 10) / 10
}
