/**
 * Tipos compartilhados do relatorio executivo de investimentos.
 *
 * `RelatorioData` e tudo que e calculado em TypeScript (aritmetica pura,
 * testavel) e serve de fonte da verdade tanto para o HTML quanto para o
 * prompt da IA. `RelatorioNarrativa` e so o texto que a IA escreve por
 * cima desses numeros — ela nunca deveria precisar (nem ser instruida a)
 * recalcular nada que ja esteja aqui.
 */

export type VeredictoRendaFixa = 'manter' | 'avaliar' | 'reduzir' | 'nao_avaliavel'
export type VeredictoAcao = 'aumentar' | 'manter' | 'observar' | 'reduzir'
export type Severidade = 'critica' | 'elevada' | 'moderada' | 'baixa'

export interface PosicaoAtivo {
  ativoId: string
  ticker: string
  nome: string | null
  classe: string | null
  categoria: string | null
  segmento: string | null
  setor: string | null
  corretora: string | null
  carteira: string | null
  estrategia: string | null
  indexador: string | null
  taxa: number | null
  juros: string | null
  vencimento: string | null
  dataAquisicao: string | null
  gestora: string | null
  liquidez: string | null

  quantidade: number
  precoMedio: number
  valorInvestido: number
  valorMercado: number
  proventos: number
  rentabilidade: number | null

  ehRendaFixa: boolean
  /** Só populado para renda fixa: comparação contra o Tesouro equivalente. */
  rendaFixaVeredito?: {
    veredicto: VeredictoRendaFixa
    /** Pontos percentuais de RETORNO ao ano (nunca pontos de %CDI) acima/abaixo do limiar. */
    premioPontosPercentuais: number | null
    /** Só para pós-fixados em CDI: leitura auxiliar em % do CDI, nunca usada para o veredicto. */
    equivalentePctCdi: number | null
    limiarUsado: string
    motivo: string
  }
}

export interface AlertaQualidade {
  tipo:
    | 'duplicidade_suspeita'
    | 'saldo_zero_com_custo'
    | 'variacao_incompativel'
    | 'fgc_concentrado'
    | 'campo_obrigatorio_ausente'
    | 'taxa_ambigua'
    | 'classe_sem_mapeamento'
  severidade: Severidade
  titulo: string
  descricao: string
  ativoIds: string[]
  valorEnvolvido: number | null
}

export interface AlocacaoClasse {
  classe: string
  valor: number
  percentual: number
}

export interface ConcentracaoResumo {
  maiorPosicaoPct: number
  top5Pct: number
  top10Pct: number
  porCorretora: { nome: string; valor: number; percentual: number }[]
  porSetor: { nome: string; valor: number; percentual: number }[]
}

export interface LimiaresIndiferenca {
  /** Selic meta, CDI, IPCA 12m e dolar PTAX, do Banco Central. */
  selicMeta: number | null
  cdi: number | null
  ipca12m: number | null
  dolarPtax: number | null
  /** Ibovespa/IFIX/Tesouro — manual ou pesquisado pela IA. */
  ibovespaVar12m: number | null
  ifixVar12m: number | null
  tesouroIpcaTaxa: number | null
  tesouroPreTaxa: number | null

  /** Limiar de indiferenca para papel isento indexado ao IPCA, em "IPCA + X% a.a.". */
  limiarIpcaIsento: number | null
  /** Limiar de indiferenca para papel isento prefixado, em "% a.a.". */
  limiarPreIsento: number | null
  /** Retorno liquido do Tesouro Selic equivalente, em pontos percentuais a.a. — a base de comparação real dos pós-fixados. */
  tesouroSelicLiquido: number | null

  aliquotaIrPremissa: number
  custodiaB3Premissa: number
  benchmarksModo: 'auto' | 'manual'
  benchmarksFontes: string[]
  benchmarksGeradoEm: string
}

export interface RelatorioData {
  competencia: string
  dataPosicao: string
  geradoEm: string

  patrimonioAjustado: number
  patrimonioRegistrado: number

  posicoes: PosicaoAtivo[]
  alocacaoPorClasse: AlocacaoClasse[]
  concentracao: ConcentracaoResumo
  limiares: LimiaresIndiferenca
  alertas: AlertaQualidade[]

  /** Contagens simples para a IA ter contexto sem precisar somar nada. */
  totais: {
    ativos: number
    ativosComSaldo: number
    movimentacoes: number
  }
}

export interface RelatorioTop10Item {
  acao: string
  motivo: string
  impactoEsperado: string
  risco: string
  prazo: string
  conviccao: 'alta' | 'media' | 'baixa'
}

export interface RelatorioNarrativa {
  resumoExecutivo: {
    diagnostico: string
    pontoPositivo: string
    principalRisco: string
    principalOportunidade: string
    acaoPrioritaria: string
  }
  diagnosticoGeral: string
  analiseDiversificacao: string
  analiseRisco: string
  analiseRendaFixa: string
  analiseAcoes: string
  analiseFiis: string
  analiseInternacional: string
  analiseEtfs: string
  performanceBenchmarks: string
  pontosFortes: string[]
  pontosAtencao: string[]
  oportunidades: string[]
  carteiraAlvoComentario: string
  planoRebalanceamento: string
  planoAcao: {
    dias30: { prioridade: 'alta' | 'media' | 'baixa'; texto: string }[]
    dias90: { prioridade: 'alta' | 'media' | 'baixa'; texto: string }[]
    dias180: { prioridade: 'alta' | 'media' | 'baixa'; texto: string }[]
  }
  top10: RelatorioTop10Item[]
  riscosPremissas: string[]
  conclusaoExecutiva: string
}

export interface RelatorioCompleto {
  data: RelatorioData
  narrativa: RelatorioNarrativa
}
