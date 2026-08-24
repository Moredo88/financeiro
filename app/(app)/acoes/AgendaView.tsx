'use client'

import { useMemo, useState } from 'react'
import { clsx } from 'clsx'
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { PRIORIDADE_COR, estaAtrasada, type Acao } from './types'

type Granularidade = 'mes' | 'semana' | 'dia'

interface AgendaViewProps {
  acoes: Acao[]
  hoje: string
  onAbrir: (acao: Acao) => void
}

const chave = (d: Date) => format(d, 'yyyy-MM-dd')

export default function AgendaView({ acoes, hoje, onAbrir }: AgendaViewProps) {
  const [cursor, setCursor] = useState(() => new Date())
  const [granularidade, setGranularidade] = useState<Granularidade>('mes')

  const porDia = useMemo(() => {
    const mapa = new Map<string, Acao[]>()
    acoes.forEach((a) => {
      const lista = mapa.get(a.prazo) ?? []
      lista.push(a)
      mapa.set(a.prazo, lista)
    })
    return mapa
  }, [acoes])

  const dias = useMemo(() => {
    if (granularidade === 'dia') return [cursor]
    if (granularidade === 'semana') {
      return eachDayOfInterval({
        start: startOfWeek(cursor, { weekStartsOn: 0 }),
        end: endOfWeek(cursor, { weekStartsOn: 0 }),
      })
    }
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
    })
  }, [cursor, granularidade])

  function navegar(direcao: 1 | -1) {
    setCursor((atual) => {
      if (granularidade === 'mes') return addMonths(atual, direcao)
      if (granularidade === 'semana') return addWeeks(atual, direcao)
      return addDays(atual, direcao)
    })
  }

  const rotulo =
    granularidade === 'mes'
      ? format(cursor, 'MMMM yyyy', { locale: ptBR })
      : granularidade === 'semana'
        ? `${format(startOfWeek(cursor, { weekStartsOn: 0 }), 'dd/MM')} — ${format(endOfWeek(cursor, { weekStartsOn: 0 }), 'dd/MM')}`
        : format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navegar(-1)}
            aria-label="Periodo anterior"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[10rem] text-center text-sm font-semibold capitalize text-slate-900">
            {rotulo}
          </span>
          <button
            type="button"
            onClick={() => navegar(1)}
            aria-label="Proximo periodo"
            className="cursor-pointer rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="ml-1 cursor-pointer rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Hoje
          </button>
        </div>

        <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
          {(['mes', 'semana', 'dia'] as Granularidade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGranularidade(g)}
              className={clsx(
                'cursor-pointer rounded px-3 py-1 text-xs font-medium capitalize transition-colors',
                granularidade === g ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {granularidade === 'dia' ? (
        <DiaDetalhado acoes={porDia.get(chave(cursor)) ?? []} hoje={hoje} onAbrir={onAbrir} />
      ) : (
        <Grade dias={dias} cursor={cursor} porDia={porDia} hoje={hoje} onAbrir={onAbrir} />
      )}
    </div>
  )
}

function Grade({
  dias,
  cursor,
  porDia,
  hoje,
  onAbrir,
}: {
  dias: Date[]
  cursor: Date
  porDia: Map<string, Acao[]>
  hoje: string
  onAbrir: (acao: Acao) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'].map((d) => (
          <div key={d} className="py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dias.map((dia) => {
          const itens = porDia.get(chave(dia)) ?? []
          const foraDoMes = !isSameMonth(dia, cursor)
          const ehHoje = chave(dia) === hoje
          return (
            <div
              key={dia.toISOString()}
              className={clsx(
                'min-h-[6.5rem] border-b border-r border-slate-100 p-1.5 last:border-r-0',
                foraDoMes && 'bg-slate-50/60'
              )}
            >
              <span
                className={clsx(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-xs',
                  ehHoje ? 'bg-blue-600 font-semibold text-white' : foraDoMes ? 'text-slate-300' : 'text-slate-500'
                )}
              >
                {format(dia, 'd')}
              </span>
              <div className="mt-1 space-y-1">
                {itens.slice(0, 3).map((a) => (
                  <ChipAcao key={a.id} acao={a} hoje={hoje} onClick={() => onAbrir(a)} />
                ))}
                {itens.length > 3 && (
                  <span className="block text-[11px] text-slate-400">+{itens.length - 3}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DiaDetalhado({
  acoes,
  hoje,
  onAbrir,
}: {
  acoes: Acao[]
  hoje: string
  onAbrir: (acao: Acao) => void
}) {
  if (acoes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          title="Nenhuma acao com prazo neste dia"
        />
      </div>
    )
  }

  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      {acoes.map((a) => {
        const atrasada = estaAtrasada(a, hoje)
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onAbrir(a)}
            className={clsx(
              'flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              atrasada ? 'border-red-200' : 'border-slate-200'
            )}
          >
            <span className="text-sm font-medium text-slate-900">{a.titulo}</span>
            <Badge className={PRIORIDADE_COR[a.prioridade]}>{a.prioridade}</Badge>
          </button>
        )
      })}
    </div>
  )
}

function ChipAcao({ acao, hoje, onClick }: { acao: Acao; hoje: string; onClick: () => void }) {
  const atrasada = estaAtrasada(acao, hoje)
  return (
    <button
      type="button"
      onClick={onClick}
      title={acao.titulo}
      className={clsx(
        'block w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors',
        atrasada ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
      )}
    >
      {acao.titulo}
    </button>
  )
}
