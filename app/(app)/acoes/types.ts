export type Status = 'Backlog' | 'A Fazer' | 'Em Andamento' | 'Aguardando' | 'Concluido' | 'Cancelado'
export type Prioridade = 'Baixa' | 'Media' | 'Alta' | 'Urgente'
export type TipoComentario = 'comentario' | 'status' | 'responsavel' | 'prazo'

export interface Acao {
  id: string
  titulo: string
  descricao: string
  responsavel_id: string
  solicitante_id: string | null
  area_projeto_id: string | null
  status: Status
  prioridade: Prioridade
  data_inicio: string | null
  prazo: string
  percentual_conclusao: number
  tags: string[]
  observacoes: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface Comentario {
  id: string
  acao_id: string
  autor_id: string | null
  tipo: TipoComentario
  texto: string
  created_at: string
}

export interface Usuario {
  id: string
  email: string
}

export interface AreaProjeto {
  id: string
  nome: string
  ativo: boolean
}

export const STATUS_LIST: Status[] = [
  'Backlog',
  'A Fazer',
  'Em Andamento',
  'Aguardando',
  'Concluido',
  'Cancelado',
]

export const STATUS_LABEL: Record<Status, string> = {
  Backlog: 'Backlog',
  'A Fazer': 'A Fazer',
  'Em Andamento': 'Em Andamento',
  Aguardando: 'Aguardando',
  Concluido: 'Concluido',
  Cancelado: 'Cancelado',
}

export const STATUS_COR: Record<Status, string> = {
  Backlog: 'bg-slate-100 text-slate-600',
  'A Fazer': 'bg-sky-100 text-sky-700',
  'Em Andamento': 'bg-blue-100 text-blue-700',
  Aguardando: 'bg-amber-100 text-amber-700',
  Concluido: 'bg-green-100 text-green-700',
  Cancelado: 'bg-slate-200 text-slate-500 line-through',
}

export const PRIORIDADE_LIST: Prioridade[] = ['Baixa', 'Media', 'Alta', 'Urgente']

export const PRIORIDADE_RANK: Record<Prioridade, number> = {
  Baixa: 1,
  Media: 2,
  Alta: 3,
  Urgente: 4,
}

export const PRIORIDADE_COR: Record<Prioridade, string> = {
  Baixa: 'bg-slate-100 text-slate-600',
  Media: 'bg-blue-100 text-blue-700',
  Alta: 'bg-amber-100 text-amber-700',
  Urgente: 'bg-red-100 text-red-700',
}

/** Status que tiram a acao da contagem de atrasadas/pendentes. */
export const STATUS_FINALIZADOS: Status[] = ['Concluido', 'Cancelado']

/** Hoje, no formato date do Postgres (yyyy-MM-dd), em horario local. */
export function hojeISO(): string {
  const d = new Date()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}

export function estaAtrasada(acao: Acao, hoje: string): boolean {
  return acao.prazo < hoje && !STATUS_FINALIZADOS.includes(acao.status)
}
