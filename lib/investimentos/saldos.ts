/**
 * Fechamento mensal de saldos.
 *
 * O saldo de cada ativo no primeiro dia util do mes vira um registro
 * imutavel. E dele que sai a serie historica de patrimonio e o rendimento
 * — nao dos campos cotacao_atual / saldo_devedor, que sao sobrescritos.
 */

export interface Fechamento {
  id: string
  competencia: string
  data_posicao: string
  status: 'Aberto' | 'Fechado'
  observacao: string | null
}

export type OrigemSaldo = 'B3' | 'Manual' | 'Repetido'

export interface SaldoMensal {
  id: string
  fechamento_id: string
  ativo_id: string
  quantidade: number | null
  preco_unitario: number | null
  saldo: number
  aportes_mes: number
  resgates_mes: number
  proventos_mes: number
  origem: OrigemSaldo
}

/** Linha da view v_saldos_mensais. */
export interface SaldoMensalView extends SaldoMensal {
  competencia: string
  data_posicao: string
  fechamento_status: string
  ticker: string
  ativo_nome: string | null
  ativo_status: string
  classe_nome: string | null
  categoria_nome: string | null
  corretora_nome: string | null
  carteira_nome: string | null
  saldo_anterior: number | null
  rendimento_mes: number | null
}

/** Tipos de evento que somam como entrada de dinheiro no ativo. */
const EVENTOS_APORTE = ['Compra', 'Subscricao']
/** Tipos que somam como saida. */
const EVENTOS_RESGATE = ['Venda', 'Amortizacao']
/** Tipos que somam como provento recebido no periodo. */
const EVENTOS_PROVENTO = ['Dividendo', 'JCP', 'Rendimento', 'Cupom']

export interface MovimentoPeriodo {
  ativo_id: string
  tipo_evento: string
  data_evento: string
  valor_liquido: number | null
}

export interface TotaisPeriodo {
  aportes: number
  resgates: number
  proventos: number
}

/**
 * Soma as movimentacoes de cada ativo no intervalo (inicioExclusivo, fim].
 *
 * O inicio e exclusivo porque a data do fechamento anterior ja foi contada
 * naquele fechamento — incluir de novo dobraria o aporte. Quando nao ha
 * fechamento anterior (primeiro mes), passe null: o retorno vem zerado, e
 * o rendimento do mes de entrada fica como nao apurado, que e o correto.
 */
export function totaisDoPeriodo(
  movimentos: MovimentoPeriodo[],
  inicioExclusivo: string | null,
  fim: string
): Map<string, TotaisPeriodo> {
  const totais = new Map<string, TotaisPeriodo>()
  if (!inicioExclusivo) return totais

  for (const m of movimentos) {
    if (m.data_evento <= inicioExclusivo || m.data_evento > fim) continue

    const valor = m.valor_liquido ?? 0
    const atual = totais.get(m.ativo_id) ?? { aportes: 0, resgates: 0, proventos: 0 }

    if (EVENTOS_APORTE.includes(m.tipo_evento)) atual.aportes += valor
    else if (EVENTOS_RESGATE.includes(m.tipo_evento)) atual.resgates += valor
    else if (EVENTOS_PROVENTO.includes(m.tipo_evento)) atual.proventos += valor
    else continue

    totais.set(m.ativo_id, atual)
  }

  return totais
}

/**
 * Rendimento de uma linha, com a mesma regra da view v_saldos_mensais.
 * Devolve null quando nao ha base de comparacao.
 */
export function rendimentoDe(linha: {
  saldo: number
  saldo_anterior: number | null
  aportes_mes: number
  resgates_mes: number
  proventos_mes: number
}): number | null {
  const { saldo, saldo_anterior, aportes_mes, resgates_mes, proventos_mes } = linha
  if (saldo_anterior != null) {
    return saldo - saldo_anterior - aportes_mes + resgates_mes + proventos_mes
  }
  if (aportes_mes > 0) return saldo - aportes_mes + resgates_mes + proventos_mes
  return null
}

export interface ResumoCompetencia {
  competencia: string
  /** Rotulo curto para o eixo dos graficos: 08/26. */
  rotulo: string
  saldo: number
  saldoAnterior: number
  aportes: number
  resgates: number
  proventos: number
  rendimento: number
  /** Rendimento sobre a base do mes (saldo anterior + aportes - resgates). */
  rentabilidade: number
  rendimentoAcumulado: number
}

/**
 * Consolida as linhas da view por competencia. Ja vem ordenado da mais
 * antiga para a mais nova, que e a ordem dos graficos.
 */
export function resumirPorCompetencia(linhas: SaldoMensalView[]): ResumoCompetencia[] {
  const porMes = new Map<string, ResumoCompetencia>()

  for (const l of linhas) {
    const atual = porMes.get(l.competencia) ?? {
      competencia: l.competencia,
      rotulo: rotuloCompetencia(l.competencia),
      saldo: 0,
      saldoAnterior: 0,
      aportes: 0,
      resgates: 0,
      proventos: 0,
      rendimento: 0,
      rentabilidade: 0,
      rendimentoAcumulado: 0,
    }

    atual.saldo += l.saldo
    atual.saldoAnterior += l.saldo_anterior ?? 0
    atual.aportes += l.aportes_mes
    atual.resgates += l.resgates_mes
    atual.proventos += l.proventos_mes
    atual.rendimento += l.rendimento_mes ?? 0

    porMes.set(l.competencia, atual)
  }

  let acumulado = 0
  return Array.from(porMes.values())
    .sort((a, b) => a.competencia.localeCompare(b.competencia))
    .map((m) => {
      acumulado += m.rendimento
      const base = m.saldoAnterior + m.aportes - m.resgates
      return {
        ...m,
        rentabilidade: base > 0 ? m.rendimento / base : 0,
        rendimentoAcumulado: acumulado,
      }
    })
}

/** '2026-08-01' -> '08/26' */
export function rotuloCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-')
  return `${mes}/${ano.slice(2)}`
}

/** Qualquer data ISO -> primeiro dia do mes dela. */
export function competenciaDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`
}

/**
 * Primeiro dia do mes que nao e sabado, domingo nem feriado.
 *
 * Espelha primeiro_dia_util() do banco; existe no cliente so para propor
 * a data ao abrir um fechamento novo, sem ida ao servidor.
 */
export function primeiroDiaUtil(competencia: string, feriados: Set<string>): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const cursor = new Date(Date.UTC(ano, mes - 1, 1))

  while (true) {
    const iso = cursor.toISOString().slice(0, 10)
    const diaSemana = cursor.getUTCDay()
    if (diaSemana !== 0 && diaSemana !== 6 && !feriados.has(iso)) return iso
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
}

/** Competencia seguinte a informada. */
export function proximaCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split('-').map(Number)
  const proximo = new Date(Date.UTC(ano, mes, 1))
  return `${proximo.getUTCFullYear()}-${String(proximo.getUTCMonth() + 1).padStart(2, '0')}-01`
}
