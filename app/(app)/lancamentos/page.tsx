'use client'

import { useState, useEffect, useCallback } from 'react'
import { addDays, addWeeks, addMonths, addYears, format, parseISO } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { formatDate, STATUS_COLORS } from '@/lib/utils'
import { useValores } from '@/components/ValoresProvider'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import MultiSelect from '@/components/ui/MultiSelect'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import ExportButton from '@/components/ui/ExportButton'
import { Th, useOrdenacao } from '@/components/ui/Ordenacao'
import { exportToExcel } from '@/lib/export'
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

const STATUS_OPTIONS = [
  { value: 'R', label: 'Realizado' },
  { value: 'P', label: 'Previsto' },
]

const MAX_OCORRENCIAS_RECORRENCIA = 500

// Campo da coluna -> expressao de ordenacao do PostgREST. As de tabela
// relacionada usam a forma tabela(coluna), que ordena as linhas de cima.
const COLUNA_ORDEM: Record<string, string> = {
  data: 'data',
  valor: 'valor',
  descricao: 'descricao',
  categoria: 'categorias(nome)',
  classe: 'classes(nome)',
  frequencia: 'frequencias(nome)',
  conta: 'contas(nome)',
  status: 'status',
}

const INCREMENTO_POR_FREQUENCIA: Record<string, (d: Date) => Date> = {
  Diario: (d) => addDays(d, 1),
  Semanal: (d) => addWeeks(d, 1),
  Mensal: (d) => addMonths(d, 1),
  Trimestral: (d) => addMonths(d, 3),
  Semestral: (d) => addMonths(d, 6),
  Anual: (d) => addYears(d, 1),
}

function gerarDatasRecorrencia(dataInicio: string, dataFim: string, frequenciaNome: string | undefined): string[] {
  const incrementar = frequenciaNome ? INCREMENTO_POR_FREQUENCIA[frequenciaNome] : undefined
  if (!incrementar) return [dataInicio]

  const fim = parseISO(dataFim)
  const datas: string[] = []
  let atual = parseISO(dataInicio)

  while (atual <= fim && datas.length < MAX_OCORRENCIAS_RECORRENCIA + 1) {
    datas.push(format(atual, 'yyyy-MM-dd'))
    atual = incrementar(atual)
  }

  return datas
}

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
  recorrente: false,
  dataFimRecorrencia: '',
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
    categoria_id: [] as string[],
    classe_id: [] as string[],
    conta_id: [] as string[],
    frequencia_id: [] as string[],
    status: [] as string[],
  })

  const [modalOpen, setModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteErro, setDeleteErro] = useState<string | null>(null)

  const { ordem, alternar } = useOrdenacao({ campo: 'data', direcao: 'desc' })

  // Trocar a ordem muda quem esta na primeira pagina, entao volta para ela.
  function ordenarColuna(campo: string) {
    setPage(0)
    alternar(campo)
  }

  const { moeda } = useValores()

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

  const buildFilteredQuery = useCallback(() => {
    let query = supabase
      .from('lancamentos')
      .select('*, categorias(nome), classes(nome), frequencias(nome), contas(nome)', { count: 'exact' })
      // A lista e paginada no servidor, entao ordenar no cliente reordenaria so
      // a pagina visivel. O PostgREST ordena as linhas de cima por coluna de
      // tabela relacionada quando o vinculo e para-um, que e o caso aqui.
      .order(COLUNA_ORDEM[ordem.campo] ?? 'data', { ascending: ordem.direcao === 'asc', nullsFirst: false })

    if (filters.dataInicio) query = query.gte('data', filters.dataInicio)
    if (filters.dataFim) query = query.lte('data', filters.dataFim)
    if (filters.categoria_id.length > 0) query = query.in('categoria_id', filters.categoria_id)
    if (filters.classe_id.length > 0) query = query.in('classe_id', filters.classe_id)
    if (filters.conta_id.length > 0) query = query.in('conta_id', filters.conta_id)
    if (filters.frequencia_id.length > 0) query = query.in('frequencia_id', filters.frequencia_id)
    if (filters.status.length > 0) query = query.in('status', filters.status)

    return query
  }, [filters, ordem])

  const loadLancamentos = useCallback(async () => {
    setLoading(true)
    const { data, count } = await buildFilteredQuery()
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setLancamentos((data as Lancamento[]) ?? [])
    setTotal(count ?? 0)
    setLoading(false)
  }, [page, buildFilteredQuery])

  async function handleExport() {
    // Exporta todos os registros que passam pelos filtros, nao apenas a pagina atual.
    const { data } = await buildFilteredQuery()
    const rows = (data as Lancamento[]) ?? []

    await exportToExcel('lancamentos', 'Lancamentos', [
      { header: 'Data', width: 12, value: (l) => formatDate(l.data) },
      { header: 'Valor', width: 14, value: (l) => l.valor },
      { header: 'Descricao', width: 40, value: (l) => l.descricao },
      { header: 'Categoria', width: 20, value: (l) => l.categorias?.nome },
      { header: 'Classe', width: 16, value: (l) => l.classes?.nome },
      { header: 'Frequencia', width: 16, value: (l) => l.frequencias?.nome },
      { header: 'Conta', width: 16, value: (l) => l.contas?.nome },
      { header: 'Status', width: 12, value: (l) => (l.status === 'R' ? 'Realizado' : 'Previsto') },
      { header: 'Parcial', width: 14, value: (l) => l.parcial },
      { header: 'Reembolso', width: 14, value: (l) => l.reembolso },
      { header: 'Observacao', width: 40, value: (l) => l.observacao },
    ], rows)
  }

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
      recorrente: false,
      dataFimRecorrencia: '',
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.data || !form.valor) return

    if (!editId && form.recorrente && !form.dataFimRecorrencia) return
    if (!editId && form.recorrente && form.dataFimRecorrencia < form.data) return

    setSaving(true)

    const basePayload = {
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
      await supabase.from('lancamentos').update({ ...basePayload, data: form.data }).eq('id', editId)
    } else if (form.recorrente) {
      const frequenciaNome = frequencias.find((f) => f.id === form.frequencia_id)?.nome
      const datas = gerarDatasRecorrencia(form.data, form.dataFimRecorrencia, frequenciaNome)

      if (datas.length > MAX_OCORRENCIAS_RECORRENCIA) {
        alert(`Esse periodo gera mais de ${MAX_OCORRENCIAS_RECORRENCIA} lancamentos. Reduza o intervalo entre Inicio e Fim.`)
        setSaving(false)
        return
      }

      await supabase.from('lancamentos').insert(datas.map((data) => ({ ...basePayload, data })))
    } else {
      await supabase.from('lancamentos').insert({ ...basePayload, data: form.data })
    }

    setSaving(false)
    setModalOpen(false)
    loadLancamentos()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    setDeleteErro(null)

    const { error } = await supabase.from('lancamentos').delete().eq('id', deleteId)
    setDeleting(false)

    if (error) {
      setDeleteErro(`Nao foi possivel excluir: ${error.message}`)
      return
    }

    setDeleteModalOpen(false)
    setDeleteId(null)
    loadLancamentos()
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleRecorrente() {
    setForm((prev) => ({ ...prev, recorrente: !prev.recorrente }))
  }

  function updateFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
    setPage(0)
  }

  function updateMultiFilter(field: string, values: string[]) {
    setFilters((prev) => ({ ...prev, [field]: values }))
    setPage(0)
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const toOptions = (items: CadastroItem[]) => items.map((i) => ({ value: i.id, label: i.nome }))

  const frequenciaSelecionadaNome = frequencias.find((f) => f.id === form.frequencia_id)?.nome
  const frequenciaSuportaRecorrencia = !!frequenciaSelecionadaNome && frequenciaSelecionadaNome in INCREMENTO_POR_FREQUENCIA

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
          <MultiSelect
            label="Categoria"
            options={toOptions(categorias)}
            placeholder="Todas"
            values={filters.categoria_id}
            onChange={(values) => updateMultiFilter('categoria_id', values)}
          />
          <MultiSelect
            label="Classe"
            options={toOptions(classes)}
            placeholder="Todas"
            values={filters.classe_id}
            onChange={(values) => updateMultiFilter('classe_id', values)}
          />
          <MultiSelect
            label="Conta"
            options={toOptions(contas)}
            placeholder="Todas"
            values={filters.conta_id}
            onChange={(values) => updateMultiFilter('conta_id', values)}
          />
          <MultiSelect
            label="Frequencia"
            options={toOptions(frequencias)}
            placeholder="Todas"
            values={filters.frequencia_id}
            onChange={(values) => updateMultiFilter('frequencia_id', values)}
          />
          <MultiSelect
            label="Status"
            options={STATUS_OPTIONS}
            placeholder="Todos"
            values={filters.status}
            onChange={(values) => updateMultiFilter('status', values)}
          />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{total} lancamento(s)</p>
        <div className="flex items-center gap-2">
          <ExportButton onExport={handleExport} disabled={total === 0} />
          <Button onClick={openCreate} size="sm">
            <Plus className="h-4 w-4" />
            Novo Lancamento
          </Button>
        </div>
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
                  <Th campo="data" ordem={ordem} aoOrdenar={ordenarColuna}>Data</Th>
                  <Th campo="valor" ordem={ordem} aoOrdenar={ordenarColuna} alinhamento="right">Valor</Th>
                  <Th campo="descricao" ordem={ordem} aoOrdenar={ordenarColuna}>Descricao</Th>
                  <Th campo="categoria" ordem={ordem} aoOrdenar={ordenarColuna}>Categoria</Th>
                  <Th campo="classe" ordem={ordem} aoOrdenar={ordenarColuna}>Classe</Th>
                  <Th campo="frequencia" ordem={ordem} aoOrdenar={ordenarColuna}>Frequencia</Th>
                  <Th campo="conta" ordem={ordem} aoOrdenar={ordenarColuna}>Conta</Th>
                  <Th campo="status" ordem={ordem} aoOrdenar={ordenarColuna} alinhamento="center">Status</Th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600 w-24">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {lancamentos.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 text-slate-900 whitespace-nowrap">{formatDate(l.data)}</td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-900 whitespace-nowrap">
                      {moeda(l.valor)}
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
                          onClick={() => { setDeleteId(l.id); setDeleteErro(null); setDeleteModalOpen(true) }}
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
          {!editId && frequenciaSuportaRecorrencia && (
            <div className="md:col-span-2 rounded-lg border border-slate-200 p-3 space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.recorrente}
                  onChange={toggleRecorrente}
                  className="rounded border-slate-300"
                />
                Lancamento recorrente (repete pela Frequencia selecionada)
              </label>
              {form.recorrente && (
                <Input
                  id="f-fim-recorrencia"
                  label={`Repetir ate (a partir de ${form.data ? formatDate(form.data) : '-'})`}
                  type="date"
                  value={form.dataFimRecorrencia}
                  min={form.data}
                  onChange={(e) => updateForm('dataFimRecorrencia', e.target.value)}
                  required
                />
              )}
            </div>
          )}
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
            options={STATUS_OPTIONS}
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
        <p className="text-sm text-slate-600 mb-4">
          Tem certeza que deseja excluir este lancamento? Essa acao nao pode ser desfeita.
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
