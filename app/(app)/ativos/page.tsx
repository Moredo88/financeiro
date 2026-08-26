'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MultiSelect from '@/components/ui/MultiSelect'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ExportButton from '@/components/ui/ExportButton'
import { Th, useOrdenacao, ordenarPor } from '@/components/ui/Ordenacao'
import { exportToExcel } from '@/lib/export'
import { formatDate } from '@/lib/utils'
import { Plus, Pencil, Trash2 } from 'lucide-react'

interface LookupItem { id: string; nome: string }

interface Ativo {
  id: string
  ticker: string
  nome: string | null
  classe_id: string | null
  categoria_id: string | null
  segmento_id: string | null
  banco_corretora_id: string | null
  casa_analise_id: string | null
  gestora_securitizadora: string | null
  fonte_recomendacao: string | null
  descricao: string | null
  data_aquisicao: string | null
  status: string
  taxa: number | null
  indexador: string | null
  data_vencimento: string | null
  classes_ativo: { nome: string } | null
}

// Colunas opcionais do quadro. Renda variavel e demais investimentos mostram
// conjuntos diferentes, mas sempre nesta ordem de encaixe.
type ColunaExtra = 'categoria' | 'taxa' | 'indexador'

const STATUS_OPTIONS = [
  { value: 'Ativo', label: 'Ativo' },
  { value: 'Inativo', label: 'Inativo' },
  { value: 'Liquidado', label: 'Liquidado' },
]

const STATUS_BADGE: Record<string, string> = {
  Ativo: 'bg-green-100 text-green-700',
  Inativo: 'bg-slate-100 text-slate-500',
  Liquidado: 'bg-red-100 text-red-700',
}

// A classe no cadastro e 'RENDA VAR'. Compara pelo prefixo para continuar
// funcionando caso ela seja renomeada para 'RENDA VARIAVEL' em Parametros.
function ehRendaVariavel(nome: string | null | undefined) {
  if (!nome) return false
  return nome.trim().toUpperCase().startsWith('RENDA VAR')
}

const emptyForm = {
  ticker: '',
  nome: '',
  classe_id: '',
  categoria_id: '',
  segmento_id: '',
  banco_corretora_id: '',
  casa_analise_id: '',
  gestora_securitizadora: '',
  fonte_recomendacao: '',
  descricao: '',
  data_aquisicao: '',
  status: 'Ativo',
  taxa: '',
  data_vencimento: '',
}

export default function AtivosPage() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [classeFiltro, setClasseFiltro] = useState<string[]>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState<string[]>([])
  const [corretoraFiltro, setCorretoraFiltro] = useState<string[]>([])
  const [statusFiltro, setStatusFiltro] = useState<string[]>([])

  const [classes, setClasses] = useState<LookupItem[]>([])
  const [categorias, setCategorias] = useState<LookupItem[]>([])
  const [segmentos, setSegmentos] = useState<LookupItem[]>([])
  const [bancos, setBancos] = useState<LookupItem[]>([])
  const [casasAnalise, setCasasAnalise] = useState<LookupItem[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErro, setDeleteErro] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadLookups() {
      const [c1, c2, c3, c4, c5] = await Promise.all([
        supabase.from('classes_ativo').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('categorias_ativo').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('segmentos').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('bancos_corretoras').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('casas_analise').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setClasses(c1.data ?? [])
      setCategorias(c2.data ?? [])
      setSegmentos(c3.data ?? [])
      setBancos(c4.data ?? [])
      setCasasAnalise(c5.data ?? [])
    }
    loadLookups()
  }, [])

  const loadAtivos = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('ativos')
      .select('id, ticker, nome, classe_id, categoria_id, segmento_id, banco_corretora_id, casa_analise_id, gestora_securitizadora, fonte_recomendacao, descricao, data_aquisicao, status, taxa, indexador, data_vencimento, classes_ativo(nome)')
      .order('ticker')

    if (busca.trim()) {
      query = query.or(`ticker.ilike.%${busca.trim()}%,nome.ilike.%${busca.trim()}%`)
    }

    const { data } = await query
    setAtivos((data as unknown as Ativo[]) ?? [])
    setLoading(false)
  }, [busca])

  useEffect(() => {
    loadAtivos()
  }, [loadAtivos])

  function toOptions(items: LookupItem[]) {
    return items.map((i) => ({ value: i.id, label: i.nome }))
  }

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  // Botao global (Header, em qualquer tela) chega aqui via /ativos?novo=1.
  const router = useRouter()
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('novo') === '1') {
      openCreate()
      router.replace('/ativos')
    }
  }, [searchParams, router])

  function openEdit(a: Ativo) {
    setEditId(a.id)
    setForm({
      ticker: a.ticker,
      nome: a.nome ?? '',
      classe_id: a.classe_id ?? '',
      categoria_id: a.categoria_id ?? '',
      segmento_id: a.segmento_id ?? '',
      banco_corretora_id: a.banco_corretora_id ?? '',
      casa_analise_id: a.casa_analise_id ?? '',
      gestora_securitizadora: a.gestora_securitizadora ?? '',
      fonte_recomendacao: a.fonte_recomendacao ?? '',
      descricao: a.descricao ?? '',
      data_aquisicao: a.data_aquisicao ?? '',
      status: a.status,
      taxa: a.taxa != null ? String(a.taxa) : '',
      data_vencimento: a.data_vencimento ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.ticker.trim() || !form.classe_id) return
    setSaving(true)

    const payload = {
      ticker: form.ticker.trim().toUpperCase(),
      nome: form.nome || null,
      classe_id: form.classe_id || null,
      categoria_id: form.categoria_id || null,
      segmento_id: form.segmento_id || null,
      banco_corretora_id: form.banco_corretora_id || null,
      casa_analise_id: form.casa_analise_id || null,
      gestora_securitizadora: form.gestora_securitizadora || null,
      fonte_recomendacao: form.fonte_recomendacao || null,
      descricao: form.descricao || null,
      data_aquisicao: form.data_aquisicao || null,
      status: form.status,
      taxa: form.taxa ? parseFloat(form.taxa) : null,
      data_vencimento: form.data_vencimento || null,
    }

    if (editId) {
      await supabase.from('ativos').update(payload).eq('id', editId)
    } else {
      await supabase.from('ativos').insert(payload)
    }

    setSaving(false)
    setModalOpen(false)
    loadAtivos()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteErro(null)

    const { error } = await supabase.from('ativos').delete().eq('id', deleteId)
    setDeleting(false)

    // 23503 = foreign key violation. Acontece sempre que o ativo tem
    // movimentacao: a FK de movimentacoes_ativos nao tem ON DELETE CASCADE.
    if (error) {
      setDeleteErro(
        error.code === '23503'
          ? 'Este ativo tem movimentacoes vinculadas. Exclua as movimentacoes dele na tela Movimentacoes e tente de novo.'
          : `Nao foi possivel excluir: ${error.message}`
      )
      return
    }

    setDeleteModalOpen(false)
    setDeleteId(null)
    loadAtivos()
  }

  function abrirExclusao(id: string) {
    setDeleteId(id)
    setDeleteErro(null)
    setDeleteModalOpen(true)
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function nomeDe(items: LookupItem[], id: string | null) {
    return id ? items.find((i) => i.id === id)?.nome ?? '' : ''
  }

  async function handleExport() {
    await exportToExcel('ativos', 'Ativos', [
      { header: 'Ticker', width: 14, value: (a) => a.ticker },
      { header: 'Nome', width: 28, value: (a) => a.nome },
      { header: 'Classe', width: 18, value: (a) => a.classes_ativo?.nome },
      { header: 'Categoria', width: 18, value: (a) => nomeDe(categorias, a.categoria_id) },
      { header: 'Segmento', width: 24, value: (a) => nomeDe(segmentos, a.segmento_id) },
      { header: 'Banco / Corretora', width: 20, value: (a) => nomeDe(bancos, a.banco_corretora_id) },
      { header: 'Casa de Analise', width: 20, value: (a) => nomeDe(casasAnalise, a.casa_analise_id) },
      { header: 'Gestora / Securitizadora', width: 24, value: (a) => a.gestora_securitizadora },
      { header: 'Fonte da Recomendacao', width: 24, value: (a) => a.fonte_recomendacao },
      { header: 'Data de Aquisicao', width: 16, value: (a) => (a.data_aquisicao ? formatDate(a.data_aquisicao) : '') },
      { header: 'Taxa (%)', width: 12, value: (a) => a.taxa },
      { header: 'Vencimento', width: 14, value: (a) => (a.data_vencimento ? formatDate(a.data_vencimento) : '') },
      { header: 'Status', width: 12, value: (a) => a.status },
      { header: 'Descricao', width: 40, value: (a) => a.descricao },
    ], ativosFiltrados)
  }

  const ativosFiltrados = ativos.filter((a) => {
    if (classeFiltro.length && !classeFiltro.includes(a.classe_id ?? '')) return false
    if (categoriaFiltro.length && !categoriaFiltro.includes(a.categoria_id ?? '')) return false
    if (corretoraFiltro.length && !corretoraFiltro.includes(a.banco_corretora_id ?? '')) return false
    if (statusFiltro.length && !statusFiltro.includes(a.status)) return false
    return true
  })

  const rendaVariavel = ativosFiltrados.filter((a) => ehRendaVariavel(a.classes_ativo?.nome))
  const demais = ativosFiltrados.filter((a) => !ehRendaVariavel(a.classes_ativo?.nome))

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Buscar por ticker ou nome..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <ExportButton onExport={handleExport} disabled={ativosFiltrados.length === 0} />
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4" />
              Novo Ativo
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MultiSelect
            label="Classe / Tipo de Ativo"
            options={toOptions(classes)}
            values={classeFiltro}
            onChange={setClasseFiltro}
          />
          <MultiSelect
            label="Categoria"
            options={toOptions(categorias)}
            values={categoriaFiltro}
            onChange={setCategoriaFiltro}
          />
          <MultiSelect
            label="Banco / Corretora"
            options={toOptions(bancos)}
            values={corretoraFiltro}
            onChange={setCorretoraFiltro}
          />
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            values={statusFiltro}
            onChange={setStatusFiltro}
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center text-sm text-slate-500">
          Carregando...
        </div>
      ) : ativos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <EmptyState title="Nenhum ativo cadastrado" description="Clique em Novo Ativo para adicionar." />
        </div>
      ) : (
        <>
          <QuadroAtivos
            titulo="Renda Variavel"
            ativos={rendaVariavel}
            vazio="Nenhum ativo de renda variavel"
            extras={['categoria', 'taxa']}
            nomeCategoria={(id) => nomeDe(categorias, id)}
            nomeCorretora={(id) => nomeDe(bancos, id)}
            onEdit={openEdit}
            onDelete={abrirExclusao}
          />
          <QuadroAtivos
            titulo="Demais Investimentos"
            ativos={demais}
            vazio="Nenhum outro investimento cadastrado"
            extras={['taxa', 'indexador']}
            nomeCategoria={(id) => nomeDe(categorias, id)}
            nomeCorretora={(id) => nomeDe(bancos, id)}
            onEdit={openEdit}
            onDelete={abrirExclusao}
          />
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? `Editar Ativo — ${form.ticker}` : 'Novo Ativo'}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="f-ticker"
            label="Ticker"
            value={form.ticker}
            onChange={(e) => updateForm('ticker', e.target.value)}
            placeholder="Ex: ANIM3"
            required
          />
          <Input
            id="f-nome"
            label="Nome do Ativo"
            value={form.nome}
            onChange={(e) => updateForm('nome', e.target.value)}
            placeholder="Ex: EUCATEX"
          />
          <Select
            id="f-classe"
            label="Classe / Tipo de Ativo"
            options={toOptions(classes)}
            placeholder="Selecione..."
            value={form.classe_id}
            onChange={(e) => updateForm('classe_id', e.target.value)}
            required
          />
          <Select
            id="f-categoria"
            label="Categoria"
            options={toOptions(categorias)}
            placeholder="Selecione..."
            value={form.categoria_id}
            onChange={(e) => updateForm('categoria_id', e.target.value)}
          />
          <Select
            id="f-segmento"
            label="Segmento / Setor"
            options={toOptions(segmentos)}
            placeholder="Selecione..."
            value={form.segmento_id}
            onChange={(e) => updateForm('segmento_id', e.target.value)}
          />
          <Select
            id="f-banco"
            label="Banco / Corretora"
            options={toOptions(bancos)}
            placeholder="Selecione..."
            value={form.banco_corretora_id}
            onChange={(e) => updateForm('banco_corretora_id', e.target.value)}
          />
          <Select
            id="f-casa"
            label="Casa de Analise"
            options={toOptions(casasAnalise)}
            placeholder="Selecione..."
            value={form.casa_analise_id}
            onChange={(e) => updateForm('casa_analise_id', e.target.value)}
          />
          <Input
            id="f-gestora"
            label="Gestora / Securitizadora"
            value={form.gestora_securitizadora}
            onChange={(e) => updateForm('gestora_securitizadora', e.target.value)}
          />
          <Input
            id="f-fonte"
            label="Fonte da Recomendacao"
            value={form.fonte_recomendacao}
            onChange={(e) => updateForm('fonte_recomendacao', e.target.value)}
          />
          <Input
            id="f-data-aquisicao"
            label="Data de Aquisicao"
            type="date"
            value={form.data_aquisicao}
            onChange={(e) => updateForm('data_aquisicao', e.target.value)}
          />
          <Input
            id="f-taxa"
            label="Taxa (%)"
            type="number"
            step="0.0001"
            value={form.taxa}
            onChange={(e) => updateForm('taxa', e.target.value)}
            placeholder="Ex: 12,5"
          />
          <Input
            id="f-vencimento"
            label="Vencimento"
            type="date"
            value={form.data_vencimento}
            onChange={(e) => updateForm('data_vencimento', e.target.value)}
          />
          <Select
            id="f-status"
            label="Status"
            options={STATUS_OPTIONS}
            value={form.status}
            onChange={(e) => updateForm('status', e.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              id="f-descricao"
              label="Descricao"
              value={form.descricao}
              onChange={(e) => updateForm('descricao', e.target.value)}
              placeholder="Tese / observacoes do ativo"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </div>
      </Modal>

      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Excluir Ativo"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-4">
          Tem certeza que deseja excluir este ativo? As movimentacoes vinculadas tambem precisam ser removidas antes. Essa acao nao pode ser desfeita.
        </p>
        {deleteErro && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {deleteErro}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function QuadroAtivos({
  titulo,
  ativos,
  vazio,
  extras = [],
  nomeCategoria,
  nomeCorretora,
  onEdit,
  onDelete,
}: {
  titulo: string
  ativos: Ativo[]
  vazio: string
  extras?: ColunaExtra[]
  nomeCategoria: (id: string | null) => string
  nomeCorretora: (id: string | null) => string
  onEdit: (a: Ativo) => void
  onDelete: (id: string) => void
}) {
  const mostra = (c: ColunaExtra) => extras.includes(c)
  const colunas = 6 + extras.length

  // Cada quadro ordena por conta propria.
  const { ordem, alternar } = useOrdenacao({ campo: 'ticker', direcao: 'asc' })

  const linhas = ordenarPor(ativos, ordem, (a, campo) => {
    switch (campo) {
      case 'ticker': return a.ticker
      case 'nome': return a.nome
      case 'classe': return a.classes_ativo?.nome
      case 'categoria': return nomeCategoria(a.categoria_id)
      case 'corretora': return nomeCorretora(a.banco_corretora_id)
      case 'taxa': return a.taxa
      case 'indexador': return a.indexador
      case 'status': return a.status
      default: return null
    }
  })

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
        <span className="text-xs text-slate-500">{ativos.length} ativo(s)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <Th campo="ticker" ordem={ordem} aoOrdenar={alternar}>Ticker</Th>
              <Th campo="nome" ordem={ordem} aoOrdenar={alternar}>Nome</Th>
              <Th campo="classe" ordem={ordem} aoOrdenar={alternar}>Classe</Th>
              {mostra('categoria') && (
                <Th campo="categoria" ordem={ordem} aoOrdenar={alternar}>Categoria</Th>
              )}
              <Th campo="corretora" ordem={ordem} aoOrdenar={alternar}>Corretora</Th>
              {mostra('taxa') && (
                <Th campo="taxa" ordem={ordem} aoOrdenar={alternar} alinhamento="right">Taxa (%)</Th>
              )}
              {mostra('indexador') && (
                <Th campo="indexador" ordem={ordem} aoOrdenar={alternar}>Indexador</Th>
              )}
              <Th campo="status" ordem={ordem} aoOrdenar={alternar} alinhamento="center">Status</Th>
              <th className="px-3 py-3 text-right font-medium text-slate-600 w-20">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={colunas} className="px-3 py-8 text-center text-slate-400">{vazio}</td></tr>
            ) : (
              linhas.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-medium text-slate-900">{a.ticker}</td>
                  <td className="px-3 py-2.5 text-slate-700">{a.nome}</td>
                  <td className="px-3 py-2.5 text-slate-600">{a.classes_ativo?.nome}</td>
                  {mostra('categoria') && (
                    <td className="px-3 py-2.5 text-slate-600">{nomeCategoria(a.categoria_id)}</td>
                  )}
                  <td className="px-3 py-2.5 text-slate-600">{nomeCorretora(a.banco_corretora_id)}</td>
                  {mostra('taxa') && (
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {a.taxa != null ? a.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 }) : ''}
                    </td>
                  )}
                  {mostra('indexador') && (
                    <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{a.indexador}</td>
                  )}
                  <td className="px-3 py-2.5 text-center">
                    <Badge className={STATUS_BADGE[a.status] ?? 'bg-slate-100 text-slate-600'}>
                      {a.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onEdit(a)}
                        className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                        title="Editar cadastro"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(a.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
