import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatMonthYear(date: string | Date): string {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMM/yy', { locale: ptBR })
}

/**
 * Busca sem acento e sem caixa: "duvida" tem de achar "Duvida" e "Dúvida".
 * NFD separa a letra do acento, e a faixa U+0300-U+036F sao os acentos.
 */
export function normalizarTexto(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

export const STATUS_OPTIONS = [
  { value: 'R', label: 'Realizado' },
  { value: 'P', label: 'Previsto' },
] as const

export const STATUS_COLORS: Record<string, string> = {
  R: 'bg-green-100 text-green-700',
  P: 'bg-yellow-100 text-yellow-700',
}
