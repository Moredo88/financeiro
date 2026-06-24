'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, STATUS_COLORS } from '@/lib/utils'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'

interface CadastroItem { id: string; nome: string }
interface Lancamento {
  id: string
  data: string
  valor: number
  descricao: string | null
  categoria_id: string | null
  classe_id: string | null
  frequencia_id: string | null
  conta_id: string | null
  parcial: string | null
  reembolso: string | null
  status: string
  observacao: string | null
  categorias: { nome: string } | null
  classes: { nome: string } | null
  frequencias: { nome: string } | null
  contas: { nome: string } | null
}

const PAGE_SIZE = 25

const emptyForm = {
  data: new Date().toISOString().slice(0, 10),
  valor: '',
  descricao: '',
  categoria_id: '',
  classe_id: '',
  frequencia_id: '',
  conta_id: '',
  parcial: '',
  reembolso: '',
  status: 'R',
  observacao: '',
}

export default function LancamentosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const [categorias, setCategorias] = useState<CadastroItem[]>([])
  const [classes, setClasses] = useState<CadastroItem[]>([])
  const [frequencias, setFrequencias] = useState<CadastroItem[]>([])
  const [contas, setContas] = useState<CadastroItem[]>([])

  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: '',
    categoria_id: '',
    classe_id: '',
    conta_id: '',
    frequencia_id: '',
    status: '',
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function loadCadastros() {
      const [c1, c2, c3, c4] = await Promise.all([
        supabase.from('categorias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('classes').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('frequencias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setCategorias(c1.data ?? [])
      setClasses(c2.data ?? [])
      setFrequencias(c3.data ?? [])
      setContas(c4.data ?? [])
    }
    loadCadastros()
  }, [])

  const loadLancamentos = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('lancamentos')
      .select('*, categorias(nome), classes(nome), frequencias(nome), contas(nome)', { count: 'exact' })
      .order('data', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (filters.dataInicio) query = query.gte('data', filters.dataInicio)
    if (filters.dataFim) query = query.lte('data', filters.dataFim)
    if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id)
    if (filters.classe_id) query = query.eq('classe_id', filters.classe_id)
    if (filters.conta_id) query = query.eq('conta_id', filters.conta_id)
    if (filters.frequencia_id) query = query.eq('frequencia_id', filters.frequencia_id)
    if (filters.status) query = query.eq('status', filters.status)

    const { data, count } = await query
    setLancamentos((data as Lancamento[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, filters])

  useEffect(() => {
    loadLancamentos()
  }, [loadLancamentos])

  function openCreate() {
    setEditId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(l: Lancamento) {
    setEditId(l.id)
    setForm({
      data: l.data,
      valor: String(l.valor),
      descricao: l.descricao ?? '',
      categoria_id: l.categoria_id ?? '',
      classe_id: l.classe_id ?? '',
      frequencia_id: l.frequencia_id ?? '',
      conta_id: l.conta_id ?? '',
      parcial: l.parcial ?? '',
      reembolso: l.reembolso ?? '',
      status: l.status,
      observacao: l.observacao ?? '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.data || !form.valor) return
    setSaving(true)

    const payload = {
      data: form.data,
      valor: parseFloat(form.valor),
      descricao: form.descricao || null,
      categoria_id: form.categoria_id || null,
      classe_id: form.classe_id || null,
      frequencia_id: form.frequencia_id || null,
      conta_id: form.conta_id || null,
      parcial: form.parcial || null,
      reembolso: form.reembolso || null,
      status: form.status,
      observacao: form.observacao || null,
    }

    if (editId) {
      await supabase.from('lancamentos').update(payload).eq('id', editId)
    } else {
      await supabase.from('lancamentos').insert(payload)
    }

    setSaving(false)
    setModalOpen(false)
    loadLancamentos()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('lancamentos').delete().eq('id', deleteId)
    setDeleteModalOpen(false)
    setDeleteId(null)
    loadLancamentos()
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const toOptions = (items: CadastroItem[]) => items.map((i) => ({ value: i.id, label: i.nome }))

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <Input
            type="date"
            placeholder="Data inicio"
            value={filters.dataInicio}
            onChange={(e) => updateFilter('dataInicio', e.target.value)}
            label="De"
          />
          <Input
            type="date"
            placeholder="Data fim"
            value={filters.dataFim}
            onChange={(e) => updateFilter('dataFim', e.target.value)}
            label="Ate"
          />
          <Select
            label="Categoria"
            options={toOptions(categorias)}
            placeholder="Todas"
            value={filters.categoria_id}
            onChange={(e) => updateFilter('categoria_id', e.target.value)}
          />
          <Select
            label="Classe"
            options={toOptions(classes)}
            placeholder="Todas"
            value={filters.classe_id}
            onChange={(e) => updateFilter('classe_id', e.target.value)}
          />
          <Select
            label="Conta"
            options={toOptions(contas)}
            placeholder="Todas"
            value={filters.conta_id}
            onChange={(e) => updateFilter('conta_id', e.target.value)}
          />
          <Select
            label="Frequencia"
            options={toOptions(frequencias)}
            placeholder="Todas"
            value={filters.frequencia_id}
            onChange={(e) => updateFilter('frequencia_id', e.target.value)}
          />
          <Select
            label="Status"
            options={[
              { value: 'R', label: 'Realizado' },
              { value: 'P', label: 'Previsto' },
            ]}
            placeholder="Todos"
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value)}
          />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} lancamento(s)</p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          Novo Lancamento
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : lancamentos.length === 0 ? (
          <EmptyState title="Nenhum lancamento" description="Clique em Novo para adicionar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Data</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600">Valor</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Descricao</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Categoria</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Classe</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Frequencia</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Conta</th>
                  <th className="px-3 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600 w-24">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-900 whitespace-nowrap">{formatDate(l.data)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(l.valor)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 max-w-[200px] truncate">{l.descricao}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.categorias?.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.classes?.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.frequencias?.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{l.contas?.nome}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge className={STATUS_COLORS[l.status] ?? 'bg-slate-100 text-slate-600'}>
                        {l.status === 'R' ? 'Real' : 'Prev'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(l)} className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteId(l.id); setDeleteModalOpen(true) }}
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

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Pagina {page + 1} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Modal Criar/Editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? 'Editar Lancamento' : 'Novo Lancamento'}
        size="lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            id="f-data"
            label="Data"
            type="date"
            value={form.data}
            onChange={(e) => updateForm('data', e.target.value)}
            required
          />
          <Input
            id="f-valor"
            label="Valor (R$)"
            type="number"
            step="0.01"
            value={form.valor}
            onChange={(e) => updateForm('valor', e.target.value)}
            placeholder="0,00"
            required
          />
          <div className="md:col-span-2">
            <Input
              id="f-descricao"
              label="Descricao"
              value={form.descricao}
              onChange={(e) => updateForm('descricao', e.target.value)}
              placeholder="Descricao do lancamento"
            />
          </div>
          <Select
            id="f-categoria"
            label="Categoria"
            options={toOptions(categorias)}
            placeholder="Selecione..."
            value={form.categoria_id}
            onChange={(e) => updateForm('categoria_id', e.target.value)}
          />
          <Select
            id="f-classe"
            label="Classe"
            options={toOptions(classes)}
            placeholder="Selecione..."
            value={form.classe_id}
            onChange={(e) => updateForm('classe_id', e.target.value)}
          />
          <Select
            id="f-frequencia"
            label="Frequencia"
            options={toOptions(frequencias)}
            placeholder="Selecione..."
            value={form.frequencia_id}
            onChange={(e) => updateForm('frequencia_id', e.target.value)}
          />
          <Select
            id="f-conta"
            label="Conta"
            options={toOptions(contas)}
            placeholder="Selecione..."
            value={form.conta_id}
            onChange={(e) => updateForm('conta_id', e.target.value)}
          />
          <Input
            id="f-parcial"
            label="Parcial"
            value={form.parcial}
            onChange={(e) => updateForm('parcial', e.target.value)}
          />
          <Input
            id="f-reembolso"
            label="Reembolso"
            value={form.reembolso}
            onChange={(e) => updateForm('reembolso', e.target.value)}
          />
          <Select
            id="f-status"
            label="Status"
            options={[
              { value: 'R', label: 'Realizado' },
              { value: 'P', label: 'Previsto' },
            ]}
            value={form.status}
            onChange={(e) => updateForm('status', e.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              id="f-obs"
              label="Observacao"
              value={form.observacao}
              onChange={(e) => updateForm('observacao', e.target.value)}
              placeholder="Observacoes..."
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

      {/* Modal Excluir */}
      <Modal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Excluir Lancamento"
        size="sm"
      >
        <p className="text-sm text-slate-600 mb-6">
          Tem certeza que deseja excluir este lancamento? Essa acao nao pode ser desfeita.
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
