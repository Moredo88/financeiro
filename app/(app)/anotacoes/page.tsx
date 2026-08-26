'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, normalizarTexto } from '@/lib/utils'
import {
  Search,
  Pin,
  PinOff,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  StickyNote,
  AlertTriangle,
} from 'lucide-react'

interface Anotacao {
  id: string
  titulo: string
  descricao: string
  tags: string[]
  fixada: boolean
  arquivada: boolean
  created_at: string
  updated_at: string
}

type Filtro = 'todas' | 'recentes' | 'arquivadas'
type Ordenar = 'recentes' | 'antigas' | 'titulo'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todas', label: 'Todas' },
  { key: 'recentes', label: 'Recentes' },
  { key: 'arquivadas', label: 'Arquivadas' },
]

const ORDENS: { value: Ordenar; label: string }[] = [
  { value: 'recentes', label: 'Mais recentes' },
  { value: 'antigas', label: 'Mais antigas' },
  { value: 'titulo', label: 'Titulo (A-Z)' },
]

/** Recente = mexida nos ultimos 7 dias. */
const DIAS_RECENTE = 7

export default function AnotacoesPage() {
  const [anotacoes, setAnotacoes] = useState<Anotacao[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // "Recentes" e relativo ao momento da carga, e nao ao render: ler o
  // relogio durante o render tornaria a lista instavel entre renders.
  const [carregadoEm, setCarregadoEm] = useState(0)

  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todas')
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([])
  const [ordenar, setOrdenar] = useState<Ordenar>('recentes')

  const [emEdicao, setEmEdicao] = useState<Anotacao | null>(null)
  const [aExcluir, setAExcluir] = useState<Anotacao | null>(null)
  const [criacaoAberta, setCriacaoAberta] = useState(false)

  const criacaoRef = useRef<HTMLInputElement>(null)

  const supabase = useMemo(() => createClient(), [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('anotacoes')
      .select('id, titulo, descricao, tags, fixada, arquivada, created_at, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })

    if (error) {
      // Tabela ausente = migracao ainda nao rodada. O Postgres devolve
      // 42P01; o PostgREST, que responde pelo cache de schema, devolve
      // PGRST205 antes mesmo de consultar o banco.
      const semTabela =
        error.code === '42P01' ||
        error.code === 'PGRST205' ||
        /schema cache/i.test(error.message)

      setErro(
        semTabela
          ? 'A tabela de anotacoes ainda nao existe no banco. Rode a migracao supabase/migrations/20260824_anotacoes.sql no SQL Editor do Supabase.'
          : `Nao foi possivel carregar as anotacoes: ${error.message}`
      )
      setAnotacoes([])
    } else {
      setErro(null)
      setAnotacoes(data ?? [])
      setCarregadoEm(Date.now())
    }
    setCarregando(false)
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  // Botao global (Header, em qualquer tela) chega aqui via
  // /anotacoes?novo=1: mesmo atalho da tecla "n", so que acessivel de fora
  // desta pagina.
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      setCriacaoAberta(true)
      criacaoRef.current?.focus()
      router.replace('/anotacoes')
    }
  }, [searchParams, router])

  // Atalho: "n" em qualquer ponto da tela leva o cursor para a criacao
  // rapida. So dispara fora de campo de texto, senao digitar "n" numa
  // anotacao roubaria o foco.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key !== 'n' || e.ctrlKey || e.metaKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      if (alvo && ['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName)) return
      if (alvo?.isContentEditable) return
      e.preventDefault()
      // Abrir e explicito, e nao efeito colateral do foco: focus() nao
      // dispara evento de foco quando a janela nao esta ativa, e ai o
      // atalho deixaria o cursor num formulario ainda fechado.
      setCriacaoAberta(true)
      criacaoRef.current?.focus()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [])

  /** Todas as tags ja usadas, para sugerir e para filtrar. */
  const tagsExistentes = useMemo(() => {
    const vistas = new Set<string>()
    anotacoes.forEach((a) => a.tags.forEach((t) => vistas.add(t)))
    return [...vistas].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [anotacoes])

  const visiveis = useMemo(() => {
    const limite = carregadoEm - DIAS_RECENTE * 24 * 60 * 60 * 1000
    const termo = normalizarTexto(busca.trim())

    const filtradas = anotacoes.filter((a) => {
      // Arquivada so aparece no proprio filtro: senao a lista principal
      // vira o deposito de tudo que ja foi guardado.
      if (filtro === 'arquivadas') {
        if (!a.arquivada) return false
      } else {
        if (a.arquivada) return false
        if (filtro === 'recentes' && new Date(a.updated_at).getTime() < limite) return false
      }

      if (tagsFiltro.length && !a.tags.some((t) => tagsFiltro.includes(t))) return false

      if (termo) {
        const alvo = normalizarTexto([a.titulo, a.descricao, ...a.tags].join(' '))
        if (!alvo.includes(termo)) return false
      }
      return true
    })

    return [...filtradas].sort((a, b) => {
      // Fixada sempre no topo, qualquer que seja a ordenacao escolhida.
      if (a.fixada !== b.fixada) return a.fixada ? -1 : 1
      if (ordenar === 'titulo') {
        return a.titulo.localeCompare(b.titulo, 'pt-BR', { sensitivity: 'base' })
      }
      const ta = new Date(a.updated_at).getTime()
      const tb = new Date(b.updated_at).getTime()
      return ordenar === 'antigas' ? ta - tb : tb - ta
    })
  }, [anotacoes, busca, filtro, tagsFiltro, ordenar, carregadoEm])

  async function criar(titulo: string, tags: string[], descricao: string) {
    const { data, error } = await supabase
      .from('anotacoes')
      .insert({ titulo, tags, descricao })
      .select('id, titulo, descricao, tags, fixada, arquivada, created_at, updated_at')
      .single()

    if (error) {
      alert(`Nao foi possivel salvar a anotacao: ${error.message}`)
      return false
    }
    // Entra na lista na hora, sem esperar ida e volta ao banco.
    if (data) setAnotacoes((prev) => [data, ...prev])
    return true
  }

  async function salvarEdicao(id: string, campos: Partial<Anotacao>) {
    const { data, error } = await supabase
      .from('anotacoes')
      .update(campos)
      .eq('id', id)
      .select('id, titulo, descricao, tags, fixada, arquivada, created_at, updated_at')
      .single()

    if (error) {
      alert(`Nao foi possivel salvar: ${error.message}`)
      return false
    }
    if (data) setAnotacoes((prev) => prev.map((a) => (a.id === id ? data : a)))
    return true
  }

  async function excluir(id: string) {
    const { error } = await supabase
      .from('anotacoes')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      alert(`Nao foi possivel excluir: ${error.message}`)
      return
    }
    setAnotacoes((prev) => prev.filter((a) => a.id !== id))
    setAExcluir(null)
  }

  function alternarTagFiltro(tag: string) {
    setTagsFiltro((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const temFiltroAtivo = busca.trim() !== '' || tagsFiltro.length > 0 || filtro !== 'todas'

  if (erro) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div>
            <h2 className="text-sm font-semibold text-amber-900">Anotacoes indisponiveis</h2>
            <p className="mt-1 text-sm leading-relaxed text-amber-900">{erro}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={carregar}>
              Tentar novamente
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <CriacaoRapida
        inputRef={criacaoRef}
        aberta={criacaoAberta}
        onAbrir={() => setCriacaoAberta(true)}
        onFechar={() => setCriacaoAberta(false)}
        tagsExistentes={tagsExistentes}
        onCriar={criar}
      />

      {/* ---------------- Busca, filtros e ordenacao ---------------- */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por titulo, descricao ou tag..."
              aria-label="Pesquisar anotacoes"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <select
            value={ordenar}
            onChange={(e) => setOrdenar(e.target.value as Ordenar)}
            aria-label="Ordenar anotacoes"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {ORDENS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {FILTROS.map((f) => (
            <Chip key={f.key} ativo={filtro === f.key} onClick={() => setFiltro(f.key)}>
              {f.label}
            </Chip>
          ))}

          {tagsExistentes.length > 0 && <span className="mx-1 h-4 w-px bg-slate-200" />}

          {tagsExistentes.map((tag) => (
            <Chip key={tag} ativo={tagsFiltro.includes(tag)} onClick={() => alternarTagFiltro(tag)}>
              #{tag}
            </Chip>
          ))}

          {temFiltroAtivo && (
            <button
              type="button"
              onClick={() => {
                setBusca('')
                setTagsFiltro([])
                setFiltro('todas')
              }}
              className="ml-1 inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-3 w-3" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {/* ---------------- Grade de cards ---------------- */}
      {carregando ? (
        <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <EmptyState
            icon={<StickyNote className="h-12 w-12" />}
            title={temFiltroAtivo ? 'Nenhuma anotacao encontrada' : 'Nenhuma anotacao ainda'}
            description={
              temFiltroAtivo
                ? 'Ajuste a pesquisa ou os filtros.'
                : 'Escreva a primeira no campo acima. A tecla N leva o cursor para la.'
            }
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visiveis.map((a) => (
            <Card
              key={a.id}
              anotacao={a}
              onAbrir={() => setEmEdicao(a)}
              onFixar={() => salvarEdicao(a.id, { fixada: !a.fixada })}
              onArquivar={() => salvarEdicao(a.id, { arquivada: !a.arquivada })}
              onExcluir={() => setAExcluir(a)}
            />
          ))}
        </div>
      )}

      {/* ---------------- Edicao ---------------- */}
      {/* key por anotacao: cada abertura monta o formulario do zero, com os
          campos ja preenchidos, em vez de sincronizar estado por efeito. */}
      {emEdicao && (
        <ModalEdicao
          key={emEdicao.id}
          anotacao={emEdicao}
          tagsExistentes={tagsExistentes}
          onFechar={() => setEmEdicao(null)}
          onSalvar={async (campos) => {
            const ok = await salvarEdicao(emEdicao.id, campos)
            if (ok) setEmEdicao(null)
          }}
        />
      )}

      {/* ---------------- Confirmacao de exclusao ---------------- */}
      <Modal
        open={aExcluir !== null}
        onClose={() => setAExcluir(null)}
        title="Excluir anotacao"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-slate-600">
            Excluir <strong className="text-slate-900">{aExcluir?.titulo}</strong>? Ela sai da lista
            e deixa de aparecer na pesquisa.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => aExcluir && excluir(aExcluir.id)}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Blocos de montagem da tela                                          */
/* ------------------------------------------------------------------ */

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

/**
 * Comeca como uma linha so. Expande no foco, para que a tela nao abra com
 * um formulario grande ocupando o topo.
 */
function CriacaoRapida({
  inputRef,
  aberta,
  onAbrir,
  onFechar,
  tagsExistentes,
  onCriar,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  aberta: boolean
  onAbrir: () => void
  onFechar: () => void
  tagsExistentes: string[]
  onCriar: (titulo: string, tags: string[], descricao: string) => Promise<boolean>
}) {
  const [titulo, setTitulo] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [descricao, setDescricao] = useState('')
  const [salvando, setSalvando] = useState(false)

  function limpar() {
    setTitulo('')
    setTags([])
    setDescricao('')
    onFechar()
  }

  async function salvar() {
    if (!titulo.trim()) return
    setSalvando(true)
    const ok = await onCriar(titulo.trim(), tags, descricao.trim())
    setSalvando(false)
    if (ok) limpar()
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <input
        ref={inputRef}
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        onFocus={onAbrir}
        placeholder="Escreva uma anotacao..."
        aria-label="Titulo da anotacao"
        className="w-full text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
      />

      {aberta && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <EntradaTags tags={tags} onChange={setTags} sugestoes={tagsExistentes} />

          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Escreva sua anotacao..."
            aria-label="Descricao da anotacao"
            rows={3}
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={limpar}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} loading={salvando} disabled={!titulo.trim()}>
              Salvar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Tag entra por Enter ou virgula, e sai pelo x. As ja usadas aparecem como
 * sugestao: e o que evita "Comercial" e "comercial" convivendo.
 */
function EntradaTags({
  tags,
  onChange,
  sugestoes,
}: {
  tags: string[]
  onChange: (tags: string[]) => void
  sugestoes: string[]
}) {
  const [texto, setTexto] = useState('')

  function adicionar(bruta: string) {
    const tag = bruta.trim().replace(/^#/, '')
    if (!tag) return
    // Compara sem caixa para reaproveitar a grafia ja existente.
    const igual = [...tags, ...sugestoes].find(
      (t) => t.localeCompare(tag, 'pt-BR', { sensitivity: 'base' }) === 0
    )
    const escolhida = igual ?? tag
    if (!tags.includes(escolhida)) onChange([...tags, escolhida])
    setTexto('')
  }

  function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      adicionar(texto)
    } else if (e.key === 'Backspace' && !texto && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  const disponiveis = sugestoes.filter((s) => !tags.includes(s)).slice(0, 8)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 px-2 py-1.5 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
          >
            #{tag}
            <button
              type="button"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
              aria-label={`Remover tag ${tag}`}
              className="cursor-pointer text-blue-400 hover:text-blue-700"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={aoTeclar}
          onBlur={() => adicionar(texto)}
          placeholder={tags.length ? '' : 'Adicionar uma tag...'}
          aria-label="Adicionar uma tag"
          className="min-w-[8rem] flex-1 py-0.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {disponiveis.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {disponiveis.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => adicionar(s)}
              className="cursor-pointer rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600"
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({
  anotacao,
  onAbrir,
  onFixar,
  onArquivar,
  onExcluir,
}: {
  anotacao: Anotacao
  onAbrir: () => void
  onFixar: () => void
  onArquivar: () => void
  onExcluir: () => void
}) {
  return (
    <div
      className={clsx(
        'group flex flex-col rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md',
        anotacao.fixada ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
      )}
    >
      {/* Abrir e a acao principal; os botoes ficam fora dele para nao
          aninhar controle clicavel dentro de controle clicavel. */}
      <button
        type="button"
        onClick={onAbrir}
        className="cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
        aria-label={`Abrir anotacao ${anotacao.titulo}`}
      >
        <div className="flex items-start gap-2">
          <h3 className="flex-1 text-sm font-semibold text-slate-900">{anotacao.titulo}</h3>
          {anotacao.fixada && <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />}
        </div>

        {anotacao.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {anotacao.tags.map((tag) => (
              <Badge key={tag} className="bg-blue-50 text-blue-700">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {anotacao.descricao && (
          <p className="mt-2 line-clamp-4 text-sm leading-relaxed whitespace-pre-line text-slate-600">
            {anotacao.descricao}
          </p>
        )}
      </button>

      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2">
        <span className="text-xs text-slate-400">{formatDate(anotacao.updated_at)}</span>

        <div className="flex items-center gap-0.5">
          <AcaoCard
            titulo={anotacao.fixada ? 'Desafixar' : 'Fixar no topo'}
            onClick={onFixar}
            ativo={anotacao.fixada}
          >
            {anotacao.fixada ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
          </AcaoCard>

          <AcaoCard titulo="Editar" onClick={onAbrir}>
            <Pencil className="h-4 w-4" />
          </AcaoCard>

          <AcaoCard
            titulo={anotacao.arquivada ? 'Restaurar' : 'Arquivar'}
            onClick={onArquivar}
          >
            {anotacao.arquivada ? (
              <ArchiveRestore className="h-4 w-4" />
            ) : (
              <Archive className="h-4 w-4" />
            )}
          </AcaoCard>

          <AcaoCard titulo="Excluir" onClick={onExcluir} perigo>
            <Trash2 className="h-4 w-4" />
          </AcaoCard>
        </div>
      </div>
    </div>
  )
}

function AcaoCard({
  titulo,
  onClick,
  ativo,
  perigo,
  children,
}: {
  titulo: string
  onClick: () => void
  ativo?: boolean
  perigo?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={titulo}
      aria-label={titulo}
      className={clsx(
        'cursor-pointer rounded p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        perigo ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-blue-600',
        ativo && 'text-blue-600'
      )}
    >
      {children}
    </button>
  )
}

function ModalEdicao({
  anotacao,
  tagsExistentes,
  onFechar,
  onSalvar,
}: {
  anotacao: Anotacao
  tagsExistentes: string[]
  onFechar: () => void
  onSalvar: (campos: Partial<Anotacao>) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(anotacao.titulo)
  const [tags, setTags] = useState<string[]>(anotacao.tags)
  const [descricao, setDescricao] = useState(anotacao.descricao)
  const [salvando, setSalvando] = useState(false)

  async function salvar() {
    if (!titulo.trim()) return
    setSalvando(true)
    await onSalvar({ titulo: titulo.trim(), tags, descricao: descricao.trim() })
    setSalvando(false)
  }

  return (
    <Modal open onClose={onFechar} title="Anotacao" size="lg">
      <div className="space-y-4">
        <Input
          id="anotacao-titulo"
          label="Titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Titulo da anotacao"
          autoFocus
        />

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <EntradaTags tags={tags} onChange={setTags} sugestoes={tagsExistentes} />
        </div>

        <Textarea
          id="anotacao-descricao"
          label="Descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Escreva sua anotacao..."
          rows={8}
        />

        <p className="text-xs text-slate-400">
          Criada em {formatDate(anotacao.created_at)} · atualizada em{' '}
          {formatDate(anotacao.updated_at)}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onFechar}>
            Cancelar
          </Button>
          <Button onClick={salvar} loading={salvando} disabled={!titulo.trim()}>
            Salvar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
