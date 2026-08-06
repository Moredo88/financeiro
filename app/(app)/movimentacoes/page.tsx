'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useValores } from '@/components/ValoresProvider'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MultiSelect from '@/components/ui/MultiSelect'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import EmptyState from '@/components/ui/EmptyState'
import ExportButton from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/export'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface LookupItem { id: string; nome: string }
interface AtivoLookup { id: string; ticker: string; nome: string | null; classes_ativo: { nome: string } | null }

interface Movimentacao {
  id: string
  ativo_id: string
  data_evento: string
  tipo_evento: string
  instituicao_id: string | null
  quantidade: number | null
  preco_unitario: number | null
  valor_liquido: number | null
  descricao: string | null
  ativos: { ticker: string; nome: string | null; classes_ativo: { nome: string } | null } | null
  bancos_corretoras: { nome: string } | null
}

const PAGE_SIZE = 25

const TIPO_EVENTO_OPTIONS = [
  { value: 'Compra', label: 'Compra' },
  { value: 'Venda', label: 'Venda' },
  { value: 'Dividendo', label: 'Dividendo' },
  { value: 'JCP', label: 'JCP' },
  { value: 'Rendimento', label: 'Rendimento' },
  { value: 'Cupom', label: 'Cupom' },
  { value: 'Amortizacao', label: 'Amortizacao' },
  { value: 'Bonificacao', label: 'Bonificacao' },
  { value: 'Subscricao', label: 'Subscricao' },
]

const emptyForm = {
  ativo_id: '',
  data_evento: new Date().toISOString().slice(0, 10),
  tipo_evento: 'Compra',
  instituicao_id: '',
  quantidade: '',
  preco_unitario: '',
  valor_liquido: '',
  descricao: '',
}

export default function MovimentacoesPage() {
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [ativos, setAtivos] = useState<AtivoLookup[]>([])
  const [instituicoes, setInstituicoes] = useState<LookupItem[]>([])

  const [filters, setFilters] = useState({
    ativo_id: [] as string[],
    tipo_evento: [] as string[],
    instituicao_id: [] as string[],
    dataInicio: '',
    dataFim: '',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [valorManual, setValorManual] = useState(false)
  const [saving, setSaving] = useState(false)

  const { moeda } = useValores()

  const supabase = createClient()

  useEffect(() => {
    async function loadLookups() {
      const [a, i] = await Promise.all([
        supabase.from('ativos').select('id, ticker, nome, classes_ativo(nome)').order('ticker'),
        supabase.from('bancos_corretoras').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setAtivos((a.data as unknown as AtivoLookup[]) ?? [])
      setInstituicoes(i.data ?? [])
    }
    loadLookups()
  }, [])

  const buildFilteredQuery = useCallback(() => {
    let query = supabase
      .from('movimentacoes_ativos')
      .select('*, ativos(ticker, nome, classes_ativo(nome)), bancos_corretoras(nome)', { count: 'exact' })
      .order('data_evento', { ascending: false })

    if (filters.ativo_id.length > 0) query = query.in('ativo_id', filters.ativo_id)
    if (filters.tipo_evento.length > 0) query = query.in('tipo_evento', filters.tipo_evento)
    if (filters.instituicao_id.length > 0) query = query.in('instituicao_id', filters.instituicao_id)
    if (filters.dataInicio) query = query.gte('data_evento', filters.dataInicio)
    if (filters.dataFim) query = query.lte('data_evento', filters.dataFim)

    return query
  }, [filters])

  const loadMovimentacoes = useCallback(async () => {
    setLoading(true)
    const { data, count } = await buildFilteredQuery()
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setMovimentacoes((data as unknown as Movimentacao[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, buildFilteredQuery])

  async function handleExport() {
    // Exporta todos os registros filtrados, nao apenas a pagina atual.
    const { data } = await buildFilteredQuery()
    const rows = (data as unknown as Movimentacao[]) ?? []

    await exportToExcel('movimentacoes', 'Movimentacoes', [
      { header: 'Data', width: 12, value: (m) => formatDate(m.data_evento) },
      { header: 'Ticker', width: 14, value: (m) => m.ativos?.ticker },
      { header: 'Ativo', width: 28, value: (m) => m.ativos?.nome },
      { header: 'Classe', width: 16, value: (m) => m.ativos?.classes_ativo?.nome },
      { header: 'Tipo de Evento', width: 16, value: (m) => m.tipo_evento },
      { header: 'Instituicao', width: 18, value: (m) => m.bancos_corretoras?.nome },
      { header: 'Quantidade', width: 14, value: (m) => m.quantidade },
      { header: 'Preco Unitario', width: 16, value: (m) => m.preco_unitario },
      { header: 'Valor Liquido', width: 16, value: (m) => m.valor_liquido },
      { header: 'Descricao', width: 40, value: (m) => m.descricao },
    ], rows)
  }

  useEffect(() => {
    loadMovimentacoes()
  }, [loadMovimentacoes])

  function toOptions(items: LookupItem[]) {
    return items.map((i) => ({ value: i.id, label: i.nome }))
  }

  const ativoOptions = ativos.map((a) => ({ value: a.id, label: `${a.ticker}${a.nome ? ` - ${a.nome}` : ''}` }))

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setValorManual(false)
    setModalOpen(true)
  }

  function openEdit(m: Movimentacao) {
    setEditId(m.id)
    setForm({
      ativo_id: m.ativo_id,
      data_evento: m.data_evento,
      tipo_evento: m.tipo_evento,
      instituicao_id: m.instituicao_id ?? '',
      quantidade: m.quantidade != null ? String(m.quantidade) : '',
      preco_unitario: m.preco_unitario != null ? String(m.preco_unitario) : '',
      valor_liquido: m.valor_liquido != null ? String(m.valor_liquido) : '',
      descricao: m.descricao ?? '',
    })
    setValorManual(true)
    setModalOpen(true)
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if ((field === 'quantidade' || field === 'preco_unitario') && !valorManual) {
        const qtd = parseFloat(field === 'quantidade' ? value : next.quantidade)
        const preco = parseFloat(field === 'preco_unitario' ? value : next.preco_unitario)
        if (!isNaN(qtd) && !isNaN(preco)) {
          next.valor_liquido = (qtd * preco).toFixed(2)
        }
      }
      return next
    })
  }

  function updateValorLiquido(value: string) {
    setValorManual(true)
    setForm((prev) => ({ ...prev, valor_liquido: value }))
  }

  function updateFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(0)
  }

  function updateMultiFilter(field: string, values: string[]) {
    setFilters((prev) => ({ ...prev, [field]: values }))
    setPage(0)
  }

  async function handleSave() {
    if (!form.ativo_id || !form.data_evento || !form.tipo_evento) return
    setSaving(true)

    const payload = {
      ativo_id: form.ativo_id,
      data_evento: form.data_evento,
      tipo_evento: form.tipo_evento,
      instituicao_id: form.instituicao_id || null,
      quantidade: form.quantidade ? parseFloat(form.quantidade) : null,
      preco_unitario: form.preco_unitario ? parseFloat(form.preco_unitario) : null,
      valor_liquido: form.valor_liquido ? parseFloat(form.valor_liquido) : null,
      descricao: form.descricao || null,
    }

    if (editId) {
      await supabase.from('movimentacoes_ativos').update(payload).eq('id', editId)
    } else {
      await supabase.from('movimentacoes_ativos').insert(payload)
    }

    setSaving(false)
    setModalOpen(false)
    loadMovimentacoes()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('movimentacoes_ativos').delete().eq('id', deleteId)
    setDeleteModalOpen(false)
    setDeleteId(null)
    loadMovimentacoes()
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const ativoSelecionado = ativos.find((a) => a.id === form.ativo_id)

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MultiSelect
            label="Ticker"
            options={ativoOptions}
            placeholder="Todos"
            values={filters.ativo_id}
            onChange={(values) => updateMultiFilter('ativo_id', values)}
          />
          <MultiSelect
            label="Tipo de Evento"
            options={TIPO_EVENTO_OPTIONS}
            placeholder="Todos"
            values={filters.tipo_evento}
            onChange={(values) => updateMultiFilter('tipo_evento', values)}
          />
          <MultiSelect
            label="Instituicao"
            options={toOptions(instituicoes)}
            placeholder="Todas"
            values={filters.instituicao_id}
            onChange={(values) => updateMultiFilter('instituicao_id', values)}
          />
          <Input
            type="date"
            label="De"
            value={filters.dataInicio}
            onChange={(e) => updateFilter('dataInicio', e.target.value)}
          />
          <Input
            type="date"
            label="Ate"
            value={filters.dataFim}
            onChange={(e) => updateFilter('dataFim', e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} movimentacao(oes)</p>
        <div className="flex items-center gap-2">
          <ExportButton onExport={handleExport} disabled={total === 0} />
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            Nova Movimentacao
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : movimentacoes.length === 0 ? (
          <EmptyState title="Nenhuma movimentacao" description="Clique em Nova Movimentacao para adicionar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Data</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Ticker</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Ativo</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Tipo</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Instituicao</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">Quantidade</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">Preco Unit.</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">Valor Liquido</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600 w-24">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoes.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-900 whitespace-nowrap">{formatDate(m.data_evento)}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">{m.ativos?.ticker}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[160px] truncate">{m.ativos?.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{m.tipo_evento}</td>
                    <td className="px-3 py-2.5 text-slate-600">{m.bancos_corretoras?.nome}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{m.quantidade ?? '-'}</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">
                      {moeda(m.preco_unitario)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900">
                      {moeda(m.valor_liquido)}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(m)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteId(m.id); setDeleteModalOpen(true) }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">Pagina {page + 1} de {totalPages}</p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Movimentacao' : 'Nova Movimentacao'}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            id="m-ativo"
            label="Ticker"
            options={ativoOptions}
            placeholder="Selecione..."
            value={form.ativo_id}
            onChange={(e) => updateForm('ativo_id', e.target.value)}
            required
          />
          <Input
            label="Ativo / Categoria"
            value={ativoSelecionado ? `${ativoSelecionado.nome ?? ''} (${ativoSelecionado.classes_ativo?.nome ?? '-'})` : ''}
            disabled
          />
          <Input
            id="m-data"
            label="Data do Evento / Pagamento"
            type="date"
            value={form.data_evento}
            onChange={(e) => updateForm('data_evento', e.target.value)}
            required
          />
          <Select
            id="m-tipo"
            label="Tipo de Evento"
            options={TIPO_EVENTO_OPTIONS}
            value={form.tipo_evento}
            onChange={(e) => updateForm('tipo_evento', e.target.value)}
            required
          />
          <Select
            id="m-instituicao"
            label="Instituicao"
            options={toOptions(instituicoes)}
            placeholder="Selecione..."
            value={form.instituicao_id}
            onChange={(e) => updateForm('instituicao_id', e.target.value)}
          />
          <Input
            id="m-quantidade"
            label="Quantidade"
            type="number"
            step="0.00000001"
            value={form.quantidade}
            onChange={(e) => updateForm('quantidade', e.target.value)}
          />
          <Input
            id="m-preco"
            label="Preco Unitario (R$)"
            type="number"
            step="0.0001"
            value={form.preco_unitario}
            onChange={(e) => updateForm('preco_unitario', e.target.value)}
          />
          <Input
            id="m-valor"
            label="Valor Liquido (R$)"
            type="number"
            step="0.01"
            value={form.valor_liquido}
            onChange={(e) => updateValorLiquido(e.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              id="m-descricao"
              label="Descricao / Observacao"
              value={form.descricao}
              onChange={(e) => updateForm('descricao', e.target.value)}
              placeholder='Ex: "CUPOM CRA EUCATEX Venc 15-01-2030"'
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
        title="Excluir Movimentacao"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Tem certeza que deseja excluir esta movimentacao? Essa acao nao pode ser desfeita.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  )
}
