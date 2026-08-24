'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import { formatDate } from '@/lib/utils'
import { Copy, Trash2, X } from 'lucide-react'
import {
  STATUS_LIST,
  STATUS_LABEL,
  PRIORIDADE_LIST,
  hojeISO,
  type Acao,
  type AreaProjeto,
  type Comentario,
  type Prioridade,
  type Status,
  type Usuario,
} from './types'

interface CamposAcao {
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
  observacoes: string
}

interface AcaoModalProps {
  acao: Acao | null
  usuarios: Usuario[]
  areas: AreaProjeto[]
  tagsExistentes: string[]
  currentUserId: string | null
  podeExcluir: boolean
  onFechar: () => void
  onCriar: (campos: CamposAcao) => Promise<Acao | null>
  onSalvar: (acao: Acao, campos: Partial<Acao>) => Promise<boolean>
  onExcluir: (acao: Acao) => void
  onDuplicar: (acao: Acao) => void
  carregarComentarios: (acaoId: string) => Promise<Comentario[]>
  onComentar: (acaoId: string, texto: string) => Promise<boolean>
}

const ROTULO_TIPO: Record<Comentario['tipo'], string> = {
  comentario: '',
  status: 'Status',
  responsavel: 'Responsavel',
  prazo: 'Prazo',
}

export default function AcaoModal({
  acao,
  usuarios,
  areas,
  tagsExistentes,
  currentUserId,
  podeExcluir,
  onFechar,
  onCriar,
  onSalvar,
  onExcluir,
  onDuplicar,
  carregarComentarios,
  onComentar,
}: AcaoModalProps) {
  const [titulo, setTitulo] = useState(acao?.titulo ?? '')
  const [descricao, setDescricao] = useState(acao?.descricao ?? '')
  const [responsavelId, setResponsavelId] = useState(acao?.responsavel_id ?? currentUserId ?? '')
  const [solicitanteId, setSolicitanteId] = useState(acao?.solicitante_id ?? '')
  const [areaId, setAreaId] = useState(acao?.area_projeto_id ?? '')
  const [status, setStatus] = useState<Status>(acao?.status ?? 'Backlog')
  const [prioridade, setPrioridade] = useState<Prioridade>(acao?.prioridade ?? 'Media')
  const [dataInicio, setDataInicio] = useState(acao?.data_inicio ?? hojeISO())
  const [prazo, setPrazo] = useState(acao?.prazo ?? '')
  const [percentual, setPercentual] = useState(acao?.percentual_conclusao ?? 0)
  const [tags, setTags] = useState<string[]>(acao?.tags ?? [])
  const [observacoes, setObservacoes] = useState(acao?.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)

  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [carregandoComentarios, setCarregandoComentarios] = useState(!!acao)
  const [novoComentario, setNovoComentario] = useState('')
  const [enviandoComentario, setEnviandoComentario] = useState(false)

  useEffect(() => {
    if (!acao) return
    carregarComentarios(acao.id).then((c) => {
      setComentarios(c)
      setCarregandoComentarios(false)
    })
  }, [acao, carregarComentarios])

  const usuarioOptions = usuarios.map((u) => ({ value: u.id, label: u.email }))
  const areaOptions = areas.map((a) => ({ value: a.id, label: a.nome }))

  function montarCampos(): CamposAcao {
    return {
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      responsavel_id: responsavelId,
      solicitante_id: solicitanteId || null,
      area_projeto_id: areaId || null,
      status,
      prioridade,
      data_inicio: dataInicio || null,
      prazo,
      percentual_conclusao: percentual,
      tags,
      observacoes: observacoes.trim(),
    }
  }

  async function salvar() {
    if (!titulo.trim() || !responsavelId || !prazo) return
    setSalvando(true)
    const campos = montarCampos()

    const ok = acao ? await onSalvar(acao, campos) : !!(await onCriar(campos))

    setSalvando(false)
    if (ok) onFechar()
  }

  async function enviarComentario() {
    if (!acao || !novoComentario.trim()) return
    setEnviandoComentario(true)
    const ok = await onComentar(acao.id, novoComentario.trim())
    setEnviandoComentario(false)
    if (ok) {
      setComentarios((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}`,
          acao_id: acao.id,
          autor_id: currentUserId,
          tipo: 'comentario',
          texto: novoComentario.trim(),
          created_at: new Date().toISOString(),
        },
      ])
      setNovoComentario('')
    }
  }

  const valido = titulo.trim() !== '' && responsavelId !== '' && prazo !== ''

  return (
    <Modal open onClose={onFechar} title={acao ? 'Editar Acao' : 'Nova Acao'} size="lg">
      <div className="space-y-4">
        <Input
          id="acao-titulo"
          label="Titulo"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="O que precisa ser feito"
          autoFocus
        />

        <Textarea
          id="acao-descricao"
          label="Descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          rows={3}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="acao-responsavel"
            label="Responsavel"
            value={responsavelId}
            onChange={(e) => setResponsavelId(e.target.value)}
            options={usuarioOptions}
            placeholder="Selecione..."
          />
          <Select
            id="acao-solicitante"
            label="Solicitante"
            value={solicitanteId}
            onChange={(e) => setSolicitanteId(e.target.value)}
            options={usuarioOptions}
            placeholder="Nenhum"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            id="acao-area"
            label="Area/Projeto"
            value={areaId}
            onChange={(e) => setAreaId(e.target.value)}
            options={areaOptions}
            placeholder="Nenhuma"
          />
          <Select
            id="acao-status"
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as Status)}
            options={STATUS_LIST.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />
          <Select
            id="acao-prioridade"
            label="Prioridade"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as Prioridade)}
            options={PRIORIDADE_LIST.map((p) => ({ value: p, label: p }))}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            id="acao-inicio"
            label="Data de inicio"
            type="date"
            value={dataInicio ?? ''}
            onChange={(e) => setDataInicio(e.target.value)}
          />
          <Input
            id="acao-prazo"
            label="Prazo"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            required
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="acao-percentual" className="text-sm font-medium text-slate-700">
              Conclusao (%)
            </label>
            <input
              id="acao-percentual"
              type="number"
              min={0}
              max={100}
              step={5}
              value={percentual}
              onChange={(e) => setPercentual(Math.min(100, Math.max(0, Number(e.target.value))))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-700">Tags</span>
          <EntradaTags tags={tags} onChange={setTags} sugestoes={tagsExistentes} />
        </div>

        <Textarea
          id="acao-observacoes"
          label="Observacoes"
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          rows={2}
        />

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div className="flex gap-2">
            {acao && (
              <Button variant="outline" size="sm" onClick={() => onDuplicar(acao)}>
                <Copy className="h-4 w-4" />
                Duplicar
              </Button>
            )}
            {acao && podeExcluir && (
              <Button variant="outline" size="sm" onClick={() => onExcluir(acao)}>
                <Trash2 className="h-4 w-4 text-red-600" />
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onFechar}>
              Cancelar
            </Button>
            <Button onClick={salvar} loading={salvando} disabled={!valido}>
              Salvar
            </Button>
          </div>
        </div>

        {acao && (
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Historico</h3>

            {carregandoComentarios ? (
              <p className="text-sm text-slate-400">Carregando...</p>
            ) : comentarios.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum registro ainda.</p>
            ) : (
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {comentarios.map((c) =>
                  c.tipo === 'comentario' ? (
                    <div key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <p className="text-slate-700">{c.texto}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {usuarios.find((u) => u.id === c.autor_id)?.email ?? 'alguem'} ·{' '}
                        {formatDate(c.created_at)}
                      </p>
                    </div>
                  ) : (
                    <p key={c.id} className="text-xs italic text-slate-400">
                      {ROTULO_TIPO[c.tipo]}: {c.texto} · {formatDate(c.created_at)}
                    </p>
                  )
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') enviarComentario()
                }}
                placeholder="Escrever um comentario..."
                aria-label="Novo comentario"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <Button
                size="sm"
                onClick={enviarComentario}
                loading={enviandoComentario}
                disabled={!novoComentario.trim()}
              >
                Comentar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

/** Copia do padrao de tags de anotacoes/page.tsx: pequeno demais para virar componente compartilhado. */
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
              className={clsx(
                'cursor-pointer rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-600'
              )}
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
