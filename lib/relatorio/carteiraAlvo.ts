/**
 * Carteira-alvo por bucket economico.
 *
 * Nao e derivavel dos dados — reflete o perfil que o usuario confirmou em
 * 2026-08 (moderado, 10+ anos, fase de acumulacao sem resgate, reserva de
 * emergencia fora do sistema, concentracao intencional em real). Ajustar
 * aqui se o perfil mudar; o relatorio nao deveria "reinventar" o alvo a
 * cada geracao, ou o plano de rebalanceamento perderia consistencia mes a
 * mes.
 */
export const CARTEIRA_ALVO: Record<string, number> = {
  'Crédito privado + bancário': 25,
  'Tesouro / soberano': 13,
  'Previdência (PGBL)': 15,
  'Ações e ETFs Brasil': 26,
  'FIIs listados': 10,
  'Ilíquidos (FIP + FII fechado)': 4,
  Ouro: 6,
  'Exterior (BDR + ETF)': 1,
}

/**
 * Agrupa uma posicao no bucket economico do relatorio (diferente da
 * `classe_ativo` do cadastro: junta FII listado x fechado, separa ouro e
 * exterior de dentro de FUNDOS INVEST./RENDA VAR).
 */
export function buckearEconomico(p: {
  classe: string | null
  categoria: string | null
  ehExterior: boolean
}): string {
  const classe = (p.classe ?? '').toUpperCase()
  const categoria = (p.categoria ?? '').toUpperCase()

  if (classe === 'PREVIDÊNCIA') return 'Previdência (PGBL)'
  if (classe === 'TESOURO DIRETO') return 'Tesouro / soberano'

  if (classe === 'RENDA VAR') {
    if (categoria === 'FII') return 'FIIs listados'
    if (categoria === 'BDR' || p.ehExterior) return 'Exterior (BDR + ETF)'
    return 'Ações e ETFs Brasil'
  }

  if (classe === 'FUNDOS INVEST.') {
    if (categoria === 'OURO') return 'Ouro'
    if (categoria === 'FII' || categoria === 'FIP') return 'Ilíquidos (FIP + FII fechado)'
    return 'Crédito privado + bancário'
  }

  return 'Crédito privado + bancário' // RENDA FIXA, ESTRUTURADA, COE
}
