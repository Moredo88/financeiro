'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'

export type Direcao = 'asc' | 'desc'
export interface Ordem { campo: string; direcao: Direcao }

/**
 * Estado de ordenacao de uma tabela. Clicar na coluna ja ordenada inverte a
 * direcao; clicar em outra comeca ascendente.
 */
export function useOrdenacao(inicial: Ordem) {
  const [ordem, setOrdem] = useState<Ordem>(inicial)

  function alternar(campo: string) {
    setOrdem((prev) =>
      prev.campo === campo
        ? { campo, direcao: prev.direcao === 'asc' ? 'desc' : 'asc' }
        : { campo, direcao: 'asc' }
    )
  }

  return { ordem, alternar, definirOrdem: setOrdem }
}

const ehVazio = (v: unknown) => v === null || v === undefined || v === ''

/** Vazios vao sempre para o fim, nas duas direcoes. */
function comparar(a: unknown, b: unknown, direcao: Direcao) {
  if (ehVazio(a) && ehVazio(b)) return 0
  if (ehVazio(a)) return 1
  if (ehVazio(b)) return -1

  const r =
    typeof a === 'number' && typeof b === 'number'
      ? a - b
      : String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' })

  return direcao === 'asc' ? r : -r
}

/**
 * Devolve uma copia ordenada. `valorDe` traduz o campo da coluna no dado bruto
 * — numero como numero, para nao ordenar 100 antes de 20 por comparacao de texto.
 */
export function ordenarPor<T>(
  itens: T[],
  ordem: Ordem,
  valorDe: (item: T, campo: string) => unknown
): T[] {
  return [...itens].sort((a, b) => comparar(valorDe(a, ordem.campo), valorDe(b, ordem.campo), ordem.direcao))
}

interface ThProps {
  campo: string
  ordem: Ordem
  aoOrdenar: (campo: string) => void
  alinhamento?: 'left' | 'right' | 'center'
  className?: string
  children: React.ReactNode
}

/** Cabecalho clicavel. Use <th> comum para colunas que nao ordenam (Acoes). */
export function Th({ campo, ordem, aoOrdenar, alinhamento = 'left', className, children }: ThProps) {
  const ativo = ordem.campo === campo
  const Icone = !ativo ? ChevronsUpDown : ordem.direcao === 'asc' ? ChevronUp : ChevronDown

  return (
    <th
      scope="col"
      aria-sort={ativo ? (ordem.direcao === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={clsx('px-3 py-3 font-medium text-slate-600', className)}
    >
      <button
        type="button"
        onClick={() => aoOrdenar(campo)}
        title={`Ordenar por ${typeof children === 'string' ? children : campo}`}
        className={clsx(
          'group inline-flex w-full items-center gap-1 rounded cursor-pointer transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
          alinhamento === 'right' && 'justify-end',
          alinhamento === 'center' && 'justify-center',
          ativo ? 'text-slate-900' : 'hover:text-slate-800'
        )}
      >
        <span className="whitespace-nowrap">{children}</span>
        <Icone
          className={clsx(
            'h-3.5 w-3.5 shrink-0',
            ativo ? 'text-blue-600' : 'text-slate-300 group-hover:text-slate-400'
          )}
        />
      </button>
    </th>
  )
}
