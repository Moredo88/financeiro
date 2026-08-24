'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { addDays } from 'date-fns'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import MultiSelect from '@/components/ui/MultiSelect'
import { normalizarTexto } from '@/lib/utils'
import { Plus, Search, X, Kanban, ListTodo, CalendarDays, AlertTriangle } from 'lucide-react'
import { useAcoes } from './useAcoes'
import KanbanView from './KanbanView'
import ListaView from './ListaView'
import AgendaView from './AgendaView'
import AcaoModal from './AcaoModal'
import {
  STATUS_LIST,
  STATUS_LABEL,
  PRIORIDADE_LIST,
  STATUS_FINALIZADOS,
  hojeISO,
  estaAtrasada,
  type Acao,
  type Status,
} from './types'

type Visao = 'kanban' | 'lista' | 'agenda'
type FiltroRapido = 'todas' | 'minhas' | 'atrasadas' | 'hoje' | 'proximas' | 'concluidas'

const VISAO_KEY = 'ccor:acoes-visao'
const FILTRO_KEY = 'ccor:acoes-filtro-rapido'
const DIAS_PROXIMO = 3

const VISOES: { key: Visao; label: string; icon: React.ElementType }[] = [
  { key: 'kanban', label: 'Kanban', icon: Kanban },
  { key: 'lista', label: 'Lista', icon: ListTodo },
  { key: 'agenda', label: 'Agenda', icon: CalendarDays },
]

export default function AcoesPage() {
  const {
    acoes,
    areas,
    usuarios,
    userId,
    carregando,
    erro,
    recarregar,
    podeExcluir,
    criar,
    salvarEdicao,
    excluir,
    duplicar,
    comentar,
    carregarComentarios,
  } = useAcoes()

  // Data de "hoje" e lida so apos montar: evita comparar com o relogio
  // durante o render (regra de pureza) e mantem o HTML do servidor igual
  // ao primeiro render do cliente.
  const [hoje, setHoje] = useState('')
  useEffect(() => setHoje(hojeISO()), [])

  const [visao, setVisao] = useState<Visao>('kanban')
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('todas')
  useEffect(() => {
    const v = window.localStorage.getItem(VISAO_KEY)
    if (v === 'kanban' || v === 'lista' || v === 'agenda') setVisao(v)
    const f = window.localStorage.getItem(FILTRO_KEY)
    if (f) setFiltroRapido(f as FiltroRapido)
  }, [])

  function mudarVisao(v: Visao) {
    setVisao(v)
    window.localStorage.setItem(VISAO_KEY, v)
  }
  function mudarFiltroRapido(f: FiltroRapido) {
    setFiltroRapido(f)
    window.localStorage.setItem(FILTRO_KEY, f)
  }

  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string[]>([])
  const [prioridadeFiltro, setPrioridadeFiltro] = useState<string[]>([])
  const [responsavelFiltro, setResponsavelFiltro] = useState<string[]>([])
  const [areaFiltroSel, setAreaFiltroSel] = useState<string[]>([])

  const [modalAberto, setModalAberto] = useState<Acao | 'novo' | null>(null)
  const [aExcluir, setAExcluir] = useState<Acao | null>(null)

  // Botao global (Header, em qualquer tela) chega aqui via /acoes?novo=1: e
  // o jeito de abrir a criacao sem duplicar a logica de salvar fora desta
  // pagina.
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setModalAberto('novo')
      router.replace('/acoes')
    }
  }, [searchParams, router])

  const tagsExistentes = useMemo(() => {
    const vistas = new Set<string>()
    acoes.forEach((a) => a.tags.forEach((t) => vistas.add(t)))
    return [...vistas].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [acoes])

  const limiteProximas = useMemo(
    () => (hoje ? addDays(new Date(`${hoje}T00:00:00`), DIAS_PROXIMO).toISOString().slice(0, 10) : ''),
    [hoje]
  )

  const visiveis = useMemo(() => {
    if (!hoje) return []
    const termo = normalizarTexto(busca.trim())

    return acoes.filter((a) => {
      switch (filtroRapido) {
        case 'minhas':
          if (a.responsavel_id !== userId) return false
          break
        case 'atrasadas':
          if (!estaAtrasada(a, hoje)) return false
          break
        case 'hoje':
          if (a.prazo !== hoje) return false
          break
        case 'proximas':
          if (STATUS_FINALIZADOS.includes(a.status)) return false
          if (!(a.prazo > hoje && a.prazo <= limiteProximas)) return false
          break
        case 'concluidas':
          if (a.status !== 'Concluido') return false
          break
      }

      if (statusFiltro.length && !statusFiltro.includes(a.status)) return false
      if (prioridadeFiltro.length && !prioridadeFiltro.includes(a.prioridade)) return false
      if (responsavelFiltro.length && !responsavelFiltro.includes(a.responsavel_id)) return false
      if (areaFiltroSel.length && !areaFiltroSel.includes(a.area_projeto_id ?? '')) return false

      if (termo) {
        const alvo = normalizarTexto([a.titulo, a.descricao, ...a.tags].join(' '))
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [acoes, busca, filtroRapido, statusFiltro, prioridadeFiltro, responsavelFiltro, areaFiltroSel, userId, hoje, limiteProximas])

  const indicadores = useMemo(() => {
    const total = acoes.length
    const emAndamento = acoes.filter((a) => a.status === 'Em Andamento').length
    const atrasadas = hoje ? acoes.filter((a) => estaAtrasada(a, hoje)).length : 0
    const paraHoje = hoje ? acoes.filter((a) => a.prazo === hoje).length : 0
    const concluidas = acoes.filter((a) => a.status === 'Concluido').length
    const pct = total ? Math.round((concluidas / total) * 100) : 0
    return { total, emAndamento, atrasadas, paraHoje, concluidas, pct }
  }, [acoes, hoje])

  function limparFiltrosDetalhados() {
    setStatusFiltro([])
    setPrioridadeFiltro([])
    setResponsavelFiltro([])
    setAreaFiltroSel([])
  }

  const temFiltroAtivo =
    busca.trim() !== '' ||
    filtroRapido !== 'todas' ||
    statusFiltro.length > 0 ||
    prioridadeFiltro.length > 0 ||
    responsavelFiltro.length > 0 ||
    areaFiltroSel.length > 0

  async function moverStatus(acao: Acao, status: Status) {
    await salvarEdicao(acao, { status })
  }

  async function handleExcluir() {
    if (!aExcluir) return
    const ok = await excluir(aExcluir)
    if (ok) setAExcluir(null)
  }

  if (erro) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Acoes indisponiveis</h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{erro}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={recarregar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ---------------- Dashboard ---------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <CardIndicador label="Total" valor={indicadores.total} onClick={() => { mudarFiltroRapido('todas'); limparFiltrosDetalhados(); setBusca('') }} />
        <CardIndicador label="Em andamento" valor={indicadores.emAndamento} onClick={() => { mudarFiltroRapido('todas'); setStatusFiltro(['Em Andamento']) }} />
        <CardIndicador label="Atrasadas" valor={indicadores.atrasadas} destaque="red" onClick={() => { mudarFiltroRapido('atrasadas'); limparFiltrosDetalhados() }} />
        <CardIndicador label="Para hoje" valor={indicadores.paraHoje} destaque="amber" onClick={() => { mudarFiltroRapido('hoje'); limparFiltrosDetalhados() }} />
        <CardIndicador label="Concluidas" valor={indicadores.concluidas} destaque="green" onClick={() => { mudarFiltroRapido('concluidas'); limparFiltrosDetalhados() }} />
        <CardIndicador label="% Conclusao" valor={`${indicadores.pct}%`} />
      </div>

      {/* ---------------- Barra de acoes ---------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {VISOES.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => mudarVisao(v.key)}
              aria-pressed={visao === v.key}
              className={clsx(
                'inline-flex cursor-pointer items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors',
                visao === v.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              <v.icon className="h-4 w-4" />
              {v.label}
            </button>
          ))}
        </div>

        <Button size="sm" onClick={() => setModalAberto('novo')}>
          <Plus className="h-4 w-4" />
          Nova Acao
        </Button>
      </div>

      {/* ---------------- Busca e filtros ---------------- */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por titulo, descricao ou tag..."
            aria-label="Pesquisar acoes"
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ['todas', 'Todas'],
              ['minhas', 'Minhas acoes'],
              ['atrasadas', 'Atrasadas'],
              ['hoje', 'Para hoje'],
              ['proximas', 'Proximas do vencimento'],
              ['concluidas', 'Concluidas'],
            ] as [FiltroRapido, string][]
          ).map(([key, label]) => (
            <Chip key={key} ativo={filtroRapido === key} onClick={() => mudarFiltroRapido(key)}>
              {label}
            </Chip>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelect
            label="Status"
            options={STATUS_LIST.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            values={statusFiltro}
            onChange={setStatusFiltro}
          />
          <MultiSelect
            label="Prioridade"
            options={PRIORIDADE_LIST.map((p) => ({ value: p, label: p }))}
            values={prioridadeFiltro}
            onChange={setPrioridadeFiltro}
          />
          <MultiSelect
            label="Responsavel"
            options={usuarios.map((u) => ({ value: u.id, label: u.email }))}
            values={responsavelFiltro}
            onChange={setResponsavelFiltro}
          />
          <MultiSelect
            label="Area/Projeto"
            options={areas.map((a) => ({ value: a.id, label: a.nome }))}
            values={areaFiltroSel}
            onChange={setAreaFiltroSel}
          />
        </div>

        {temFiltroAtivo && (
          <button
            type="button"
            onClick={() => {
              setBusca('')
              mudarFiltroRapido('todas')
              limparFiltrosDetalhados()
            }}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </button>
        )}
      </div>

      {/* ---------------- Visao ativa ---------------- */}
      {carregando ? (
        <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
      ) : visao === 'kanban' ? (
        <KanbanView
          acoes={visiveis}
          usuarios={usuarios}
          hoje={hoje}
          onAbrir={setModalAberto}
          onMudarStatus={moverStatus}
        />
      ) : visao === 'lista' ? (
        <ListaView
          acoes={visiveis}
          usuarios={usuarios}
          areas={areas}
          hoje={hoje}
          podeExcluir={podeExcluir}
          onAbrir={setModalAberto}
          onDuplicar={duplicar}
          onExcluir={setAExcluir}
        />
      ) : (
        <AgendaView acoes={visiveis} hoje={hoje} onAbrir={setModalAberto} />
      )}

      {/* ---------------- Criar/editar ---------------- */}
      {modalAberto && (
        <AcaoModal
          key={modalAberto === 'novo' ? 'novo' : modalAberto.id}
          acao={modalAberto === 'novo' ? null : modalAberto}
          usuarios={usuarios}
          areas={areas}
          tagsExistentes={tagsExistentes}
          currentUserId={userId}
          podeExcluir={modalAberto !== 'novo' && podeExcluir(modalAberto)}
          onFechar={() => setModalAberto(null)}
          onCriar={criar}
          onSalvar={salvarEdicao}
          onExcluir={(a) => {
            setModalAberto(null)
            setAExcluir(a)
          }}
          onDuplicar={async (a) => {
            const nova = await duplicar(a)
            setModalAberto(nova ?? null)
          }}
          carregarComentarios={carregarComentarios}
          onComentar={comentar}
        />
      )}

      {/* ---------------- Confirmacao de exclusao ---------------- */}
      <Modal open={aExcluir !== null} onClose={() => setAExcluir(null)} title="Excluir acao" size="sm">
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Excluir <strong className="text-slate-900">{aExcluir?.titulo}</strong>? Essa acao nao pode
            ser desfeita.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleExcluir}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function Chip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={clsx(
        'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        ativo
          ? 'border-blue-600 bg-blue-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      )}
    >
      {children}
    </button>
  )
}

function CardIndicador({
  label,
  valor,
  destaque,
  onClick,
}: {
  label: string
  valor: number | string
  destaque?: 'red' | 'amber' | 'green'
  onClick?: () => void
}) {
  const cor =
    destaque === 'red'
      ? 'text-red-600'
      : destaque === 'amber'
        ? 'text-amber-600'
        : destaque === 'green'
          ? 'text-green-600'
          : 'text-slate-900'

  const conteudo = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={clsx('mt-1 text-2xl font-bold', cor)}>{valor}</p>
    </>
  )

  if (!onClick) {
    return <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">{conteudo}</div>
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {conteudo}
    </button>
  )
}
