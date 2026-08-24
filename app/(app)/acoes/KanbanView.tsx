'use client'

import { useState } from 'react'
import { clsx } from 'clsx'
import Badge from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { ClockAlert } from 'lucide-react'
import {
  STATUS_LIST,
  STATUS_LABEL,
  PRIORIDADE_COR,
  estaAtrasada,
  type Acao,
  type Status,
  type Usuario,
} from './types'

interface KanbanViewProps {
  acoes: Acao[]
  usuarios: Usuario[]
  hoje: string
  onAbrir: (acao: Acao) => void
  onMudarStatus: (acao: Acao, status: Status) => void
}

function emailCurto(usuarios: Usuario[], id: string) {
  return usuarios.find((u) => u.id === id)?.email.split('@')[0] ?? '—'
}

export default function KanbanView({ acoes, usuarios, hoje, onAbrir, onMudarStatus }: KanbanViewProps) {
  const [colunaSobre, setColunaSobre] = useState<Status | null>(null)

  const porColuna = (status: Status) => acoes.filter((a) => a.status === status)

  function soltar(e: React.DragEvent, status: Status) {
    e.preventDefault()
    setColunaSobre(null)
    const id = e.dataTransfer.getData('text/plain')
    const acao = acoes.find((a) => a.id === id)
    if (acao && acao.status !== status) onMudarStatus(acao, status)
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {STATUS_LIST.map((status) => {
        const itens = porColuna(status)
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault()
              setColunaSobre(status)
            }}
            onDragLeave={() => setColunaSobre((c) => (c === status ? null : c))}
            onDrop={(e) => soltar(e, status)}
            className={clsx(
              'flex w-72 shrink-0 flex-col rounded-xl border bg-slate-50 transition-colors',
              colunaSobre === status ? 'border-blue-400 bg-blue-50' : 'border-slate-200'
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <h3 className="text-sm font-semibold text-slate-700">{STATUS_LABEL[status]}</h3>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                {itens.length}
              </span>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-3" style={{ minHeight: 80 }}>
              {itens.map((acao) => (
                <Cartao
                  key={acao.id}
                  acao={acao}
                  usuarios={usuarios}
                  hoje={hoje}
                  onAbrir={() => onAbrir(acao)}
                  onMudarStatus={(s) => onMudarStatus(acao, s)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function Cartao({
  acao,
  usuarios,
  hoje,
  onAbrir,
  onMudarStatus,
}: {
  acao: Acao
  usuarios: Usuario[]
  hoje: string
  onAbrir: () => void
  onMudarStatus: (status: Status) => void
}) {
  const atrasada = estaAtrasada(acao, hoje)

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData('text/plain', acao.id)}
      className="cursor-grab space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onAbrir}
        className="cursor-pointer text-left text-sm font-medium text-slate-900 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        {acao.titulo}
      </button>

      {acao.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {acao.tags.map((tag) => (
            <Badge key={tag} className="bg-blue-50 text-blue-700">
              #{tag}
            </Badge>
          ))}
        </div>
      )}

      {acao.percentual_conclusao > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${acao.percentual_conclusao}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs">
        <Badge className={PRIORIDADE_COR[acao.prioridade]}>{acao.prioridade}</Badge>
        <span className="text-slate-400">{emailCurto(usuarios, acao.responsavel_id)}</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span
          className={clsx(
            'inline-flex items-center gap-1 text-xs font-medium',
            atrasada ? 'text-red-600' : 'text-slate-400'
          )}
        >
          {atrasada && <ClockAlert className="h-3 w-3" />}
          {formatDate(acao.prazo)}
        </span>

        <select
          value={acao.status}
          onChange={(e) => onMudarStatus(e.target.value as Status)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Status de ${acao.titulo}`}
          className="cursor-pointer rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs text-slate-600 focus:border-blue-500 focus:outline-none"
        >
          {STATUS_LIST.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
