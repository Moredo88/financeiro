export interface MovimentacaoCalc {
  ativo_id: string
  tipo_evento: string
  quantidade: number | null
  valor_liquido: number | null
}

export interface AtivoCalc {
  id: string
  classe_nome: string | null
  cotacao_atual: number | null
  saldo_devedor: number | null
}

export interface Posicao {
  ativoId: string
  quantidade: number
  precoMedio: number
  valorInvestido: number
  valorMercado: number
  proventos: number
  rentabilidade: number
}

const RENDA_FIXA_CLASSES = ['RENDA FIXA', 'ESTRUTURADA', 'TESOURO DIRETO', 'COE']

export function ehClasseRendaFixa(nome: string | null | undefined): boolean {
  if (!nome) return false
  return RENDA_FIXA_CLASSES.includes(nome.trim().toUpperCase())
}

export function calcularPosicao(ativo: AtivoCalc, movimentacoes: MovimentacaoCalc[]): Posicao {
  let quantidade = 0
  let custoCompras = 0
  let qtdComprada = 0
  let proventos = 0

  for (const m of movimentacoes) {
    if (m.ativo_id !== ativo.id) continue
    const qtd = m.quantidade ?? 0
    const valor = m.valor_liquido ?? 0

    switch (m.tipo_evento) {
      case 'Compra':
        quantidade += qtd
        qtdComprada += qtd
        custoCompras += valor
        break
      case 'Bonificacao':
      case 'Subscricao':
        quantidade += qtd
        break
      case 'Venda':
        quantidade -= qtd
        break
      case 'Dividendo':
      case 'JCP':
      case 'Rendimento':
      case 'Cupom':
        proventos += valor
        break
    }
  }

  const precoMedio = qtdComprada > 0 ? custoCompras / qtdComprada : 0
  const valorInvestido = precoMedio * quantidade
  const ehRendaFixa = ehClasseRendaFixa(ativo.classe_nome)
  const valorMercado = ehRendaFixa
    ? ativo.saldo_devedor ?? valorInvestido
    : quantidade * (ativo.cotacao_atual ?? precoMedio)
  const rentabilidade = valorInvestido > 0 ? (valorMercado + proventos - valorInvestido) / valorInvestido : 0

  return {
    ativoId: ativo.id,
    quantidade,
    precoMedio,
    valorInvestido,
    valorMercado,
    proventos,
    rentabilidade,
  }
}

export function calcularPosicoes(ativos: AtivoCalc[], movimentacoes: MovimentacaoCalc[]): Map<string, Posicao> {
  const map = new Map<string, Posicao>()
  for (const ativo of ativos) {
    map.set(ativo.id, calcularPosicao(ativo, movimentacoes))
  }
  return map
}
