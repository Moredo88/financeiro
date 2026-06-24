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

export const STATUS_OPTIONS = [
  { value: 'R', label: 'Realizado' },
  { value: 'P', label: 'Previsto' },
] as const

export const STATUS_COLORS: Record<string, string> = {
  R: 'bg-green-100 text-green-700',
  P: 'bg-yellow-100 text-yellow-700',
}
