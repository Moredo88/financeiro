import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularPosicao, ehClasseRendaFixa } from '@/lib/investimentos/posicao'
import { rendimentoDe } from '@/lib/investimentos/saldos'
import { calcularLimiares, classificarRendaFixa, type BenchmarksEntrada } from './limiares'
import { setorDoTicker } from './setores'
import { buckearEconomico } from './carteiraAlvo'
import type {
  RelatorioData,
  PosicaoAtivo,
  AlertaQualidade,
  AlocacaoClasse,
  ConcentracaoResumo,
  LimiaresIndiferenca,
  Severidade,
} from './types'

const FGC_TETO = 250_000
const CATEGORIAS_COM_FGC = new Set(['CDB', 'LCA', 'LCI', 'LCD'])
const CAMPOS_OBRIGATORIOS_RF = ['taxa', 'indexador', 'data_vencimento'] as const

interface AtivoRow {
  id: string
  ticker: string | null
  nome: string | null
  classe_id: string | null
  categoria_id: string | null
  segmento_id: string | null
  banco_corretora_id: string | null
  carteira_id: string | null
  estrategia_id: string | null
  gestora_securitizadora: string | null
  liquidez: string | null
  data_aquisicao: string | null
  data_vencimento: string | null
  cotacao_atual: number | null
  saldo_devedor: number | null
  taxa: number | null
  indexador: string | null
  juros: string | null
  status: string | null
}

interface MovimentacaoRow {
  ativo_id: string
  tipo_evento: string
  quantidade: number | null
  valor_liquido: number | null
}

interface SaldoMensalRow {
  ativo_id: string
  saldo: number
  aportes_mes: number
  resgates_mes: number
  proventos_mes: number
}

interface LookupRow {
  id: string
  nome: string
}

interface FechamentoRow {
  id: string
  competencia: string
  data_posicao: string
  status: string
}

export interface BenchmarksManuaisEntrada {
  ibovespaVar12m: number | null
  ifixVar12m: number | null
}

export interface ColetarDadosOpcoes {
  benchmarks: BenchmarksEntrada & BenchmarksManuaisEntrada
  benchmarksModo: 'auto' | 'manual'
  benchmarksFontes: string[]
}

function nomeMap(rows: LookupRow[] | null): Map<string, string> {
  return new Map((rows ?? []).map((r) => [r.id, r.nome]))
}

/** ETFs internacionais (ex.: DTCR39, LFTB11) contam como exterior, nao como Brasil, no bucket economico. */
function ehExteriorSetor(ticker: string | null): boolean {
  return setorDoTicker(ticker) === 'Índice internacional'
}

export async function coletarDadosCarteira(
  supabase: SupabaseClient,
  fechamentoId: string,
  opcoes: ColetarDadosOpcoes
): Promise<RelatorioData> {
  const { data: fechamento, error: erroFechamento } = await supabase
    .from('fechamentos')
    .select('id, competencia, data_posicao, status')
    .eq('id', fechamentoId)
    .single<FechamentoRow>()

  if (erroFechamento || !fechamento) {
    throw new Error('Fechamento não encontrado.')
  }

  const { data: fechamentoAnterior } = await supabase
    .from('fechamentos')
    .select('id, competencia, data_posicao, status')
    .lt('competencia', fechamento.competencia)
    .order('competencia', { ascending: false })
    .limit(1)
    .maybeSingle<FechamentoRow>()

  const [
    { data: ativos },
    { data: classes },
    { data: categorias },
    { data: corretoras },
    { data: carteiras },
    { data: estrategias },
    { data: movimentacoes },
    { data: saldos },
    saldosAnterioresRes,
  ] = await Promise.all([
    supabase
      .from('ativos')
      .select(
        'id, ticker, nome, classe_id, categoria_id, segmento_id, banco_corretora_id, carteira_id, estrategia_id, gestora_securitizadora, liquidez, data_aquisicao, data_vencimento, cotacao_atual, saldo_devedor, taxa, indexador, juros, status'
      )
      .returns<AtivoRow[]>(),
    supabase.from('classes_ativo').select('id, nome').returns<LookupRow[]>(),
    supabase.from('categorias_ativo').select('id, nome').returns<LookupRow[]>(),
    supabase.from('bancos_corretoras').select('id, nome').returns<LookupRow[]>(),
    supabase.from('carteiras').select('id, nome').returns<LookupRow[]>(),
    supabase.from('estrategias').select('id, nome').returns<LookupRow[]>(),
    supabase
      .from('movimentacoes_ativos')
      .select('ativo_id, tipo_evento, quantidade, valor_liquido')
      .returns<MovimentacaoRow[]>(),
    supabase
      .from('saldos_mensais')
      .select('ativo_id, saldo, aportes_mes, resgates_mes, proventos_mes')
      .eq('fechamento_id', fechamento.id)
      .returns<SaldoMensalRow[]>(),
    fechamentoAnterior
      ? supabase
          .from('saldos_mensais')
          .select('ativo_id, saldo, aportes_mes, resgates_mes, proventos_mes')
          .eq('fechamento_id', fechamentoAnterior.id)
          .returns<SaldoMensalRow[]>()
      : Promise.resolve({ data: [] as SaldoMensalRow[] }),
  ])

  const classeNome = nomeMap(classes)
  const categoriaNome = nomeMap(categorias)
  const corretoraNome = nomeMap(corretoras)
  const carteiraNome = nomeMap(carteiras)
  const estrategiaNome = nomeMap(estrategias)

  const saldosAnteriores = (saldosAnterioresRes.data ?? []) as SaldoMensalRow[]
  const saldoMap = new Map((saldos ?? []).map((s) => [s.ativo_id, s]))
  const saldoAnteriorMap = new Map(saldosAnteriores.map((s) => [s.ativo_id, s]))

  const movsPorAtivo = new Map<string, MovimentacaoRow[]>()
  for (const m of movimentacoes ?? []) {
    const lista = movsPorAtivo.get(m.ativo_id) ?? []
    lista.push(m)
    movsPorAtivo.set(m.ativo_id, lista)
  }

  const limiares = calcularLimiares(opcoes.benchmarks)

  const posicoes: PosicaoAtivo[] = []
  const alertas: AlertaQualidade[] = []

  for (const ativo of ativos ?? []) {
    if (ativo.status !== 'Ativo') continue

    const classe = ativo.classe_id ? (classeNome.get(ativo.classe_id) ?? null) : null
    const categoria = ativo.categoria_id ? (categoriaNome.get(ativo.categoria_id) ?? null) : null
    const movs = movsPorAtivo.get(ativo.id) ?? []
    const saldoMensal = saldoMap.get(ativo.id)?.saldo ?? null

    const calc = calcularPosicao(
      {
        id: ativo.id,
        classe_nome: classe,
        cotacao_atual: ativo.cotacao_atual,
        saldo_devedor: ativo.saldo_devedor,
        saldo_mensal: saldoMensal,
      },
      movs
    )

    const ehRendaFixa = ehClasseRendaFixa(classe)
    const posicao: PosicaoAtivo = {
      ativoId: ativo.id,
      ticker: ativo.ticker ?? ativo.nome ?? '(sem ticker)',
      nome: ativo.nome,
      classe,
      categoria,
      segmento: null, // campo vazio no cadastro hoje — ver nota em setores.ts
      setor: setorDoTicker(ativo.ticker),
      corretora: ativo.banco_corretora_id ? (corretoraNome.get(ativo.banco_corretora_id) ?? null) : null,
      carteira: ativo.carteira_id ? (carteiraNome.get(ativo.carteira_id) ?? null) : null,
      estrategia: ativo.estrategia_id ? (estrategiaNome.get(ativo.estrategia_id) ?? null) : null,
      indexador: ativo.indexador,
      taxa: ativo.taxa,
      juros: ativo.juros,
      vencimento: ativo.data_vencimento,
      dataAquisicao: ativo.data_aquisicao,
      gestora: ativo.gestora_securitizadora,
      liquidez: ativo.liquidez,
      quantidade: calc.quantidade,
      precoMedio: calc.precoMedio,
      valorInvestido: calc.valorInvestido,
      valorMercado: calc.valorMercado,
      proventos: calc.proventos,
      rentabilidade: calc.valorInvestido > 0 ? calc.rentabilidade : null,
      ehRendaFixa,
    }

    if (ehRendaFixa) {
      const veredicto = classificarRendaFixa(
        { categoria, indexador: ativo.indexador, taxa: ativo.taxa },
        limiares,
        opcoes.benchmarks.cdi
      )
      posicao.rendaFixaVeredito = {
        veredicto: veredicto.veredicto,
        premioPontosPercentuais: veredicto.premioPontosPercentuais,
        equivalentePctCdi: veredicto.equivalentePctCdi,
        limiarUsado: veredicto.limiarUsado,
        motivo: veredicto.motivo,
      }

      if (veredicto.taxaAmbigua) {
        alertas.push({
          tipo: 'taxa_ambigua',
          severidade: 'baixa',
          titulo: `${posicao.ticker}: taxa perto da fronteira CDI+ / %CDI`,
          descricao: `Taxa cadastrada (${ativo.taxa}) fica entre 20 e 60 — zona em que não dá para saber com certeza se o campo significa "CDI + ${ativo.taxa}%" ou "${ativo.taxa}% do CDI". Confira a nota de negociação antes de confiar no veredito calculado.`,
          ativoIds: [posicao.ativoId],
          valorEnvolvido: posicao.valorMercado,
        })
      }
    }

    posicoes.push(posicao)
  }

  // --- Duplicidade suspeita: mesmo ticker, saldo praticamente igual, corretoras
  // diferentes. Entre o par, a posicao SEM movimentacao e SEM indexador entra
  // como suspeita e sai do patrimonio ajustado; empate nao exclui ninguem.
  const porTicker = new Map<string, PosicaoAtivo[]>()
  for (const p of posicoes) {
    if (p.valorMercado <= 0) continue
    const lista = porTicker.get(p.ticker) ?? []
    lista.push(p)
    porTicker.set(p.ticker, lista)
  }

  const excluidosDoAjustado = new Set<string>()

  for (const [ticker, grupo] of porTicker) {
    if (grupo.length < 2) continue
    for (let i = 0; i < grupo.length; i++) {
      for (let j = i + 1; j < grupo.length; j++) {
        const [a, b] = [grupo[i], grupo[j]]
        if (a.corretora === b.corretora) continue
        if (Math.abs(a.valorMercado - b.valorMercado) > 1) continue

        const score = (p: PosicaoAtivo) =>
          (movsPorAtivo.get(p.ativoId)?.length ? 1 : 0) + (p.indexador ? 1 : 0)
        const scoreA = score(a)
        const scoreB = score(b)

        let suspeito: PosicaoAtivo | null = null
        if (scoreA !== scoreB) suspeito = scoreA < scoreB ? a : b

        alertas.push({
          tipo: 'duplicidade_suspeita',
          severidade: 'critica',
          titulo: `Possível duplicidade: ${ticker}`,
          descricao: suspeito
            ? `${ticker} está cadastrado duas vezes (${a.corretora} e ${b.corretora}) com saldo praticamente idêntico. O registro na ${suspeito.corretora} não tem movimentação e/ou indexador cadastrados — provável duplicidade. Excluído do patrimônio ajustado; confirme e apague o registro incorreto.`
            : `${ticker} está cadastrado duas vezes (${a.corretora} e ${b.corretora}) com saldo praticamente idêntico. Não foi possível determinar qual registro é o duplicado — os dois entram no patrimônio ajustado até que isso seja confirmado manualmente.`,
          ativoIds: [a.ativoId, b.ativoId],
          valorEnvolvido: suspeito ? suspeito.valorMercado : null,
        })

        if (suspeito) excluidosDoAjustado.add(suspeito.ativoId)
      }
    }
  }

  const posicoesAjustadas = posicoes.filter((p) => !excluidosDoAjustado.has(p.ativoId))
  const patrimonioRegistrado = posicoes.reduce((s, p) => s + p.valorMercado, 0)
  const patrimonioAjustado = posicoesAjustadas.reduce((s, p) => s + p.valorMercado, 0)

  // --- Alocação por bucket econômico (seções 04/19), sobre o patrimônio ajustado.
  const porBucket = new Map<string, number>()
  for (const p of posicoesAjustadas) {
    const bucket = buckearEconomico({ classe: p.classe, categoria: p.categoria, ehExterior: ehExteriorSetor(p.ticker) })
    porBucket.set(bucket, (porBucket.get(bucket) ?? 0) + p.valorMercado)
  }
  const alocacaoPorClasse: AlocacaoClasse[] = Array.from(porBucket.entries())
    .map(([classe, valor]) => ({
      classe,
      valor,
      percentual: patrimonioAjustado > 0 ? (valor / patrimonioAjustado) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor)

  // --- Concentração.
  const ordenadas = [...posicoesAjustadas].sort((a, b) => b.valorMercado - a.valorMercado)
  const somaTop = (n: number) => ordenadas.slice(0, n).reduce((s, p) => s + p.valorMercado, 0)
  const porCorretoraMap = new Map<string, number>()
  const porSetorMap = new Map<string, number>()
  for (const p of posicoesAjustadas) {
    if (p.corretora) porCorretoraMap.set(p.corretora, (porCorretoraMap.get(p.corretora) ?? 0) + p.valorMercado)
    if (!p.ehRendaFixa) {
      const setor = p.setor ?? 'Setor não mapeado'
      porSetorMap.set(setor, (porSetorMap.get(setor) ?? 0) + p.valorMercado)
    }
  }
  const concentracao: ConcentracaoResumo = {
    maiorPosicaoPct: patrimonioAjustado > 0 ? (somaTop(1) / patrimonioAjustado) * 100 : 0,
    top5Pct: patrimonioAjustado > 0 ? (somaTop(5) / patrimonioAjustado) * 100 : 0,
    top10Pct: patrimonioAjustado > 0 ? (somaTop(10) / patrimonioAjustado) * 100 : 0,
    porCorretora: Array.from(porCorretoraMap.entries())
      .map(([nome, valor]) => ({ nome, valor, percentual: patrimonioAjustado > 0 ? (valor / patrimonioAjustado) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor),
    porSetor: Array.from(porSetorMap.entries())
      .map(([nome, valor]) => ({ nome, valor, percentual: patrimonioAjustado > 0 ? (valor / patrimonioAjustado) * 100 : 0 }))
      .sort((a, b) => b.valor - a.valor),
  }

  // --- Demais alertas de qualidade de dado.
  for (const p of posicoesAjustadas) {
    if (p.valorMercado === 0 && p.valorInvestido > 0) {
      alertas.push({
        tipo: 'saldo_zero_com_custo',
        severidade: 'moderada',
        titulo: `${p.ticker}: saldo zerado com custo registrado`,
        descricao: `${p.ticker} tem valor investido registrado mas saldo de mercado zero — provável vencimento/resgate sem baixa no cadastro.`,
        ativoIds: [p.ativoId],
        valorEnvolvido: p.valorInvestido,
      })
    }

    if (p.ehRendaFixa && p.valorMercado > 0) {
      const faltando = CAMPOS_OBRIGATORIOS_RF.filter((campo) => {
        if (campo === 'taxa') return p.taxa == null
        if (campo === 'indexador') return !p.indexador
        return !p.vencimento
      })
      if (faltando.length > 0) {
        alertas.push({
          tipo: 'campo_obrigatorio_ausente',
          severidade: 'baixa',
          titulo: `${p.ticker}: cadastro incompleto`,
          descricao: `Faltando: ${faltando.join(', ')}. Sem esses campos o veredito desta posição não pôde ser calculado com confiança.`,
          ativoIds: [p.ativoId],
          valorEnvolvido: p.valorMercado,
        })
      }
    }

    if (!p.ehRendaFixa && !p.setor && p.classe === 'RENDA VAR') {
      alertas.push({
        tipo: 'classe_sem_mapeamento',
        severidade: 'baixa',
        titulo: `${p.ticker}: setor não mapeado`,
        descricao: `${p.ticker} não está no mapa de setores (lib/relatorio/setores.ts). Atualize o mapa para incluí-lo na análise setorial.`,
        ativoIds: [p.ativoId],
        valorEnvolvido: p.valorMercado,
      })
    }
  }

  // --- Variação mês a mês incompatível (só quando há fechamento anterior).
  if (fechamentoAnterior) {
    for (const p of posicoesAjustadas) {
      const anterior = saldoAnteriorMap.get(p.ativoId)
      const atual = saldoMap.get(p.ativoId)
      if (!anterior || !atual) continue
      const rendimento = rendimentoDe({
        saldo: atual.saldo,
        saldo_anterior: anterior.saldo,
        aportes_mes: atual.aportes_mes,
        resgates_mes: atual.resgates_mes,
        proventos_mes: atual.proventos_mes,
      })
      if (rendimento == null || anterior.saldo <= 0) continue
      const variacaoPct = rendimento / anterior.saldo
      if (variacaoPct < -0.03 && atual.aportes_mes === 0 && atual.resgates_mes === 0) {
        alertas.push({
          tipo: 'variacao_incompativel',
          severidade: 'elevada',
          titulo: `${p.ticker}: queda de ${(variacaoPct * 100).toFixed(1)}% no mês sem aporte/resgate`,
          descricao: `Saldo caiu ${(variacaoPct * 100).toFixed(1)}% frente ao fechamento anterior sem aporte ou resgate registrado. Pode ser amortização não lançada ou deterioração de crédito — confirmar antes de concluir.`,
          ativoIds: [p.ativoId],
          valorEnvolvido: Math.abs(rendimento),
        })
      }
    }
  }

  // --- FGC concentrado por instituição.
  const fgcPorCorretora = new Map<string, number>()
  for (const p of posicoesAjustadas) {
    if (!p.categoria || !CATEGORIAS_COM_FGC.has(p.categoria.toUpperCase()) || !p.corretora) continue
    fgcPorCorretora.set(p.corretora, (fgcPorCorretora.get(p.corretora) ?? 0) + p.valorMercado)
  }
  for (const [corretora, valor] of fgcPorCorretora) {
    if (valor > FGC_TETO) {
      alertas.push({
        tipo: 'fgc_concentrado',
        severidade: 'elevada',
        titulo: `FGC: ${corretora} acima do teto de proteção`,
        descricao: `R$ ${valor.toFixed(2)} em CDB/LCA/LCI/LCD na ${corretora} — acima do teto de R$ 250 mil por CPF e instituição. O excedente não tem cobertura do FGC.`,
        ativoIds: [],
        valorEnvolvido: valor,
      })
    }
  }

  const limiaresCompletos: LimiaresIndiferenca = {
    selicMeta: opcoes.benchmarks.selicMeta,
    cdi: opcoes.benchmarks.cdi,
    ipca12m: opcoes.benchmarks.ipca12m,
    dolarPtax: null,
    ibovespaVar12m: opcoes.benchmarks.ibovespaVar12m,
    ifixVar12m: opcoes.benchmarks.ifixVar12m,
    tesouroIpcaTaxa: opcoes.benchmarks.tesouroIpcaTaxa,
    tesouroPreTaxa: opcoes.benchmarks.tesouroPreTaxa,
    limiarIpcaIsento: limiares.limiarIpcaIsento,
    limiarPreIsento: limiares.limiarPreIsento,
    tesouroSelicLiquido: limiares.tesouroSelicLiquido,
    aliquotaIrPremissa: 0.15,
    custodiaB3Premissa: 0.002,
    benchmarksModo: opcoes.benchmarksModo,
    benchmarksFontes: opcoes.benchmarksFontes,
    benchmarksGeradoEm: new Date().toISOString(),
  }

  return {
    competencia: fechamento.competencia,
    dataPosicao: fechamento.data_posicao,
    geradoEm: new Date().toISOString(),
    patrimonioAjustado,
    patrimonioRegistrado,
    posicoes: posicoesAjustadas,
    alocacaoPorClasse,
    concentracao,
    limiares: limiaresCompletos,
    alertas: ordenarAlertas(alertas),
    totais: {
      ativos: (ativos ?? []).length,
      ativosComSaldo: posicoesAjustadas.filter((p) => p.valorMercado > 0).length,
      movimentacoes: (movimentacoes ?? []).length,
    },
  }
}

const SEVERIDADE_ORDEM: Record<Severidade, number> = { critica: 0, elevada: 1, moderada: 2, baixa: 3 }
function ordenarAlertas(alertas: AlertaQualidade[]): AlertaQualidade[] {
  return [...alertas].sort((a, b) => SEVERIDADE_ORDEM[a.severidade] - SEVERIDADE_ORDEM[b.severidade])
}
