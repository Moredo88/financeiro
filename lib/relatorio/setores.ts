/**
 * Setor de cada ticker de renda variavel, para a analise de concentracao
 * setorial do relatorio.
 *
 * O campo `segmento` do cadastro de ativos esta vazio para toda a carteira
 * hoje (verificado em 2026-08), entao nao ha como derivar isso do banco.
 * Este mapa e mantido a mao — um ticker fora dele aparece como "setor nao
 * mapeado" no relatorio, nunca um palpite. Atualizar aqui quando um ticker
 * novo entrar na carteira (ver TICKER_SETOR abaixo).
 */
export const TICKER_SETOR: Record<string, string> = {
  ITUB4: 'Financeiro',
  ITSA4: 'Financeiro',
  BPAC11: 'Financeiro',
  B3SA3: 'Financeiro',
  PSSA3: 'Financeiro',
  CXSE3: 'Financeiro',
  XPBR31: 'Financeiro',

  VALE3: 'Materiais básicos',
  GGBR4: 'Materiais básicos',
  GGBR3: 'Materiais básicos',
  SUZB3: 'Materiais básicos',

  PETR4: 'Petróleo e gás',
  PETR3: 'Petróleo e gás',

  AXIA3: 'Energia elétrica',
  CMIG4: 'Energia elétrica',
  CPLE3: 'Energia elétrica',
  EQTL3: 'Energia elétrica',

  CYRE3: 'Construção e imobiliário',
  CURY3: 'Construção e imobiliário',
  MULT3: 'Construção e imobiliário',

  JBSS32: 'Consumo',
  ASAI3: 'Consumo',
  RADL3: 'Consumo',
  UGPA3: 'Consumo',

  TOTS3: 'Tecnologia',

  SEER3: 'Educação',
  ECOR3: 'Infraestrutura e logística',
  ANIM3: 'Educação',

  BOVA11: 'Índice amplo',
  SMAL11: 'Índice amplo',
  DIVD11: 'Índice amplo',
  DIVO11: 'Índice amplo',
  FIND11: 'Índice amplo',
  TRIG11: 'Índice amplo',
  DTCR39: 'Índice internacional',
  LFTB11: 'Índice internacional',
}

export function setorDoTicker(ticker: string | null): string | null {
  if (!ticker) return null
  return TICKER_SETOR[ticker.trim().toUpperCase()] ?? null
}
