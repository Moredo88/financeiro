'use client'

import { clsx } from 'clsx'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { Th, useOrdenacao, ordenarPor } from '@/components/ui/Ordenacao'
import { formatDate } from '@/lib/utils'
import { Pencil, Copy, Trash2, ClockAlert, ListTodo } from 'lucide-react'
import {
  STATUS_LABEL,
  STATUS_COR,
  PRIORIDADE_COR,
  PRIORIDADE_RANK,
  estaAtrasada,
  type Acao,
  type AreaProjeto,
  type Usuario,
} from './types'

interface ListaViewProps {
  acoes: Acao[]
  usuarios: Usuario[]
  areas: AreaProjeto[]
  hoje: string
  podeExcluir: (acao: Acao) => boolean
  onAbrir: (acao: Acao) => void
  onDuplicar: (acao: Acao) => void
  onExcluir: (acao: Acao) => void
}

export default function ListaView({
  acoes,
  usuarios,
  areas,
  hoje,
  podeExcluir,
  onAbrir,
  onDuplicar,
  onExcluir,
}: ListaViewProps) {
  const { ordem, alternar } = useOrdenacao({ campo: 'prazo', direcao: 'asc' })

  const emailDe = (id: string) => usuarios.find((u) => u.id === id)?.email ?? '—'
  const areaDe = (id: string | null) => areas.find((a) => a.id === id)?.nome ?? ''

  const ordenadas = ordenarPor(acoes, ordem, (a, campo) => {
    switch (campo) {
      case 'responsavel':
        return emailDe(a.responsavel_id)
      case 'area':
        return areaDe(a.area_projeto_id)
      case 'prioridade':
        return PRIORIDADE_RANK[a.prioridade]
      case 'status':
        return a.status
      case 'inicio':
        return a.data_inicio ? new Date(a.data_inicio).getTime() : null
      case 'prazo':
        return new Date(a.prazo).getTime()
      default:
        return a.titulo
    }
  })

  if (acoes.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <EmptyState
          icon={<ListTodo className="h-12 w-12" />}
          title="Nenhuma acao encontrada"
          description="Ajuste os filtros ou crie uma nova acao."
        />
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <Th campo="titulo" ordem={ordem} aoOrdenar={alternar} className="px-4">Acao</Th>
            <Th campo="responsavel" ordem={ordem} aoOrdenar={alternar} className="px-3">Responsavel</Th>
            <Th campo="area" ordem={ordem} aoOrdenar={alternar} className="px-3">Area/Projeto</Th>
            <Th campo="prioridade" ordem={ordem} aoOrdenar={alternar} className="px-3">Prioridade</Th>
            <Th campo="status" ordem={ordem} aoOrdenar={alternar} className="px-3">Status</Th>
            <Th campo="inicio" ordem={ordem} aoOrdenar={alternar} className="px-3">Inicio</Th>
            <Th campo="prazo" ordem={ordem} aoOrdenar={alternar} className="px-3">Prazo</Th>
            <th className="px-3 py-3 text-left font-medium text-slate-600">Tags</th>
            <th className="px-3 py-3 text-right font-medium text-slate-600 w-28">Acoes</th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((acao) => {
            const atrasada = estaAtrasada(acao, hoje)
            return (
              <tr key={acao.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onAbrir(acao)}
                    className="cursor-pointer text-left font-medium text-slate-900 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
                  >
                    {acao.titulo}
                  </button>
                </td>
                <td className="px-3 py-3 text-slate-600">{emailDe(acao.responsavel_id)}</td>
                <td className="px-3 py-3 text-slate-600">{areaDe(acao.area_projeto_id) || '—'}</td>
                <td className="px-3 py-3">
                  <Badge className={PRIORIDADE_COR[acao.prioridade]}>{acao.prioridade}</Badge>
                </td>
                <td className="px-3 py-3">
                  <Badge className={STATUS_COR[acao.status]}>{STATUS_LABEL[acao.status]}</Badge>
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {acao.data_inicio ? formatDate(acao.data_inicio) : '—'}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={clsx(
                      'inline-flex items-center gap-1 font-medium',
                      atrasada ? 'text-red-600' : 'text-slate-600'
                    )}
                  >
                    {atrasada && <ClockAlert className="h-3.5 w-3.5" />}
                    {formatDate(acao.prazo)}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {acao.tags.map((tag) => (
                      <Badge key={tag} className="bg-blue-50 text-blue-700">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onAbrir(acao)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDuplicar(acao)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                      title="Duplicar"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                    {podeExcluir(acao) && (
                      <button
                        onClick={() => onExcluir(acao)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
