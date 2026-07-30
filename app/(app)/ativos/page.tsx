'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Textarea from '@/components/ui/Textarea'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react'

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
  carteira_id: string | null
  estrategia_id: string | null
  alocacao_alvo: number | null
  aporte_planejado: number | null
  recomendacao_atual: string | null
  liquidez: string | null
  retorno_12m: number | null
  preco_teto: number | null
  cotacao_atual: number | null
  taxa_indexador: string | null
  tipo_juros: string | null
  amortizacao: string | null
  data_liquidacao: string | null
  data_vencimento: string | null
  saldo_devedor: number | null
  classes_ativo: { nome: string } | null
}

const STATUS_OPTIONS = [
  { value: 'Ativo', label: 'Ativo' },
  { value: 'Inativo', label: 'Inativo' },
  { value: 'Liquidado', label: 'Liquidado' },
]

const RECOMENDACAO_OPTIONS = [
  { value: 'Comprar', label: 'Comprar' },
  { value: 'Manter', label: 'Manter' },
  { value: 'Vender', label: 'Vender' },
  { value: 'N/A', label: 'N/A' },
]

const LIQUIDEZ_OPTIONS = [
  { value: 'Alta', label: 'Alta' },
  { value: 'Media', label: 'Media' },
  { value: 'Baixa', label: 'Baixa' },
]

const TIPO_JUROS_OPTIONS = [
  { value: 'Pre', label: 'Pre' },
  { value: 'Pos', label: 'Pos' },
  { value: 'Hibrido', label: 'Hibrido' },
]

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
  carteira_id: '',
  estrategia_id: '',
  alocacao_alvo: '',
  aporte_planejado: '',
  recomendacao_atual: '',
  liquidez: '',
  retorno_12m: '',
  preco_teto: '',
  taxa_indexador: '',
  tipo_juros: '',
  amortizacao: '',
  data_liquidacao: '',
  data_vencimento: '',
  saldo_devedor: '',
}

export default function AtivosPage() {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  const [classes, setClasses] = useState<LookupItem[]>([])
  const [categorias, setCategorias] = useState<LookupItem[]>([])
  const [segmentos, setSegmentos] = useState<LookupItem[]>([])
  const [bancos, setBancos] = useState<LookupItem[]>([])
  const [casasAnalise, setCasasAnalise] = useState<LookupItem[]>([])
  const [carteiras, setCarteiras] = useState<LookupItem[]>([])
  const [estrategias, setEstrategias] = useState<LookupItem[]>([])
  const [tags, setTags] = useState<LookupItem[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'cadastro' | 'parametros'>('cadastro')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    async function loadLookups() {
      const [c1, c2, c3, c4, c5, c6, c7, c8] = await Promise.all([
        supabase.from('classes_ativo').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('categorias_ativo').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('segmentos').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('bancos_corretoras').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('casas_analise').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('carteiras').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('estrategias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('tags_exposicao').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setClasses(c1.data ?? [])
      setCategorias(c2.data ?? [])
      setSegmentos(c3.data ?? [])
      setBancos(c4.data ?? [])
      setCasasAnalise(c5.data ?? [])
      setCarteiras(c6.data ?? [])
      setEstrategias(c7.data ?? [])
      setTags(c8.data ?? [])
    }
    loadLookups()
  }, [])

  const loadAtivos = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('ativos')
      .select('*, classes_ativo(nome)')
      .order('ticker')

    if (busca.trim()) {
      query = query.or(`ticker.ilike.%${busca.trim()}%,nome.ilike.%${busca.trim()}%`)
    }

    const { data } = await query
    setAtivos((data as Ativo[]) ?? [])
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
    setTagsSelecionadas([])
    setModalTab('cadastro')
    setModalOpen(true)
  }

  async function openEdit(a: Ativo, tab: 'cadastro' | 'parametros') {
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
      carteira_id: a.carteira_id ?? '',
      estrategia_id: a.estrategia_id ?? '',
      alocacao_alvo: a.alocacao_alvo != null ? String(a.alocacao_alvo) : '',
      aporte_planejado: a.aporte_planejado != null ? String(a.aporte_planejado) : '',
      recomendacao_atual: a.recomendacao_atual ?? '',
      liquidez: a.liquidez ?? '',
      retorno_12m: a.retorno_12m != null ? String(a.retorno_12m) : '',
      preco_teto: a.preco_teto != null ? String(a.preco_teto) : '',
      taxa_indexador: a.taxa_indexador ?? '',
      tipo_juros: a.tipo_juros ?? '',
      amortizacao: a.amortizacao ?? '',
      data_liquidacao: a.data_liquidacao ?? '',
      data_vencimento: a.data_vencimento ?? '',
      saldo_devedor: a.saldo_devedor != null ? String(a.saldo_devedor) : '',
    })

    const { data: ativoTags } = await supabase
      .from('ativo_tags')
      .select('tag_id')
      .eq('ativo_id', a.id)
    setTagsSelecionadas((ativoTags ?? []).map((t) => t.tag_id))

    setModalTab(tab)
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
      carteira_id: form.carteira_id || null,
      estrategia_id: form.estrategia_id || null,
      alocacao_alvo: form.alocacao_alvo ? parseFloat(form.alocacao_alvo) : null,
      aporte_planejado: form.aporte_planejado ? parseFloat(form.aporte_planejado) : null,
      recomendacao_atual: form.recomendacao_atual || null,
      liquidez: form.liquidez || null,
      retorno_12m: form.retorno_12m ? parseFloat(form.retorno_12m) : null,
      preco_teto: form.preco_teto ? parseFloat(form.preco_teto) : null,
      taxa_indexador: form.taxa_indexador || null,
      tipo_juros: form.tipo_juros || null,
      amortizacao: form.amortizacao || null,
      data_liquidacao: form.data_liquidacao || null,
      data_vencimento: form.data_vencimento || null,
      saldo_devedor: form.saldo_devedor ? parseFloat(form.saldo_devedor) : null,
    }

    let ativoId = editId
    if (editId) {
      await supabase.from('ativos').update(payload).eq('id', editId)
    } else {
      const { data } = await supabase.from('ativos').insert(payload).select('id').single()
      ativoId = data?.id ?? null
    }

    if (ativoId) {
      await supabase.from('ativo_tags').delete().eq('ativo_id', ativoId)
      if (tagsSelecionadas.length > 0) {
        await supabase.from('ativo_tags').insert(
          tagsSelecionadas.map((tagId) => ({ ativo_id: ativoId, tag_id: tagId }))
        )
      }
    }

    setSaving(false)
    setModalOpen(false)
    loadAtivos()
  }

  async function handleDelete() {
    if (!deleteId) return
    await supabase.from('ativos').delete().eq('id', deleteId)
    setDeleteModalOpen(false)
    setDeleteId(null)
    loadAtivos()
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleTag(tagId: string) {
    setTagsSelecionadas((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    )
  }

  const classeSelecionada = classes.find((c) => c.id === form.classe_id)?.nome
  const ehRendaFixa = classeSelecionada === 'Renda Fixa' || classeSelecionada === 'Estruturada'

  const STATUS_BADGE: Record<string, string> = {
    Ativo: 'bg-green-100 text-green-700',
    Inativo: 'bg-slate-100 text-slate-500',
    Liquidado: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex items-center justify-between gap-4">
        <Input
          placeholder="Buscar por ticker ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          Novo Ativo
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : ativos.length === 0 ? (
          <EmptyState title="Nenhum ativo cadastrado" description="Clique em Novo Ativo para adicionar." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Ticker</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Nome</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Classe</th>
                  <th className="px-3 py-3 text-center font-medium text-slate-600">Status</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600 w-28">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{a.ticker}</td>
                    <td className="px-3 py-2.5 text-slate-700">{a.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.classes_ativo?.nome}</td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge className={STATUS_BADGE[a.status] ?? 'bg-slate-100 text-slate-600'}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(a, 'cadastro')}
                          className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Editar cadastro"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(a, 'parametros')}
                          className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                          title="Editar parametros"
                        >
                          <SlidersHorizontal className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => { setDeleteId(a.id); setDeleteModalOpen(true) }}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Excluir"
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editId ? `Editar Ativo — ${form.ticker}` : 'Novo Ativo'}
        size="lg"
      >
        <div className="flex items-center gap-2 border-b border-slate-200 mb-4">
          <button
            onClick={() => setModalTab('cadastro')}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              modalTab === 'cadastro' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Cadastro
          </button>
          <button
            onClick={() => editId && setModalTab('parametros')}
            disabled={!editId}
            title={!editId ? 'Salve o cadastro antes de definir os parametros' : undefined}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              !editId ? 'border-transparent text-slate-300 cursor-not-allowed' :
              modalTab === 'parametros' ? 'border-blue-600 text-blue-600 cursor-pointer' : 'border-transparent text-slate-500 hover:text-slate-700 cursor-pointer'
            }`}
          >
            Parametros
          </button>
        </div>

        {modalTab === 'cadastro' ? (
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
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                id="p-carteira"
                label="Carteira / Portfolio"
                options={toOptions(carteiras)}
                placeholder="Selecione..."
                value={form.carteira_id}
                onChange={(e) => updateForm('carteira_id', e.target.value)}
              />
              <Select
                id="p-estrategia"
                label="Estrategia"
                options={toOptions(estrategias)}
                placeholder="Selecione..."
                value={form.estrategia_id}
                onChange={(e) => updateForm('estrategia_id', e.target.value)}
              />
              <Input
                id="p-alocacao"
                label="Alocacao-alvo (%)"
                type="number"
                step="0.01"
                value={form.alocacao_alvo}
                onChange={(e) => updateForm('alocacao_alvo', e.target.value)}
              />
              <Input
                id="p-aporte"
                label="Aporte planejado (R$)"
                type="number"
                step="0.01"
                value={form.aporte_planejado}
                onChange={(e) => updateForm('aporte_planejado', e.target.value)}
              />
              <Select
                id="p-recomendacao"
                label="Recomendacao atual"
                options={RECOMENDACAO_OPTIONS}
                placeholder="Selecione..."
                value={form.recomendacao_atual}
                onChange={(e) => updateForm('recomendacao_atual', e.target.value)}
              />
              <Select
                id="p-liquidez"
                label="Liquidez"
                options={LIQUIDEZ_OPTIONS}
                placeholder="Selecione..."
                value={form.liquidez}
                onChange={(e) => updateForm('liquidez', e.target.value)}
              />
              <Input
                id="p-retorno"
                label="Retorno 12 meses (%)"
                type="number"
                step="0.01"
                value={form.retorno_12m}
                onChange={(e) => updateForm('retorno_12m', e.target.value)}
              />
              <Input
                id="p-preco-teto"
                label="Preco-teto / Preco-alvo (R$)"
                type="number"
                step="0.0001"
                value={form.preco_teto}
                onChange={(e) => updateForm('preco_teto', e.target.value)}
              />
            </div>

            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">Tags de exposicao</p>
              <div className="flex flex-wrap gap-3">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tagsSelecionadas.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="rounded border-slate-300"
                    />
                    {tag.nome}
                  </label>
                ))}
              </div>
            </div>

            {ehRendaFixa && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm font-semibold text-slate-900 mb-3">Renda Fixa</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    id="rf-taxa"
                    label="Taxa / Indexador"
                    value={form.taxa_indexador}
                    onChange={(e) => updateForm('taxa_indexador', e.target.value)}
                    placeholder="Ex: 126% do CDI"
                  />
                  <Select
                    id="rf-juros"
                    label="Tipo de Juros"
                    options={TIPO_JUROS_OPTIONS}
                    placeholder="Selecione..."
                    value={form.tipo_juros}
                    onChange={(e) => updateForm('tipo_juros', e.target.value)}
                  />
                  <Input
                    id="rf-amortizacao"
                    label="Amortizacao"
                    value={form.amortizacao}
                    onChange={(e) => updateForm('amortizacao', e.target.value)}
                  />
                  <Input
                    id="rf-saldo"
                    label="Saldo devedor (R$)"
                    type="number"
                    step="0.01"
                    value={form.saldo_devedor}
                    onChange={(e) => updateForm('saldo_devedor', e.target.value)}
                  />
                  <Input
                    id="rf-liquidacao"
                    label="Data de Liquidacao"
                    type="date"
                    value={form.data_liquidacao}
                    onChange={(e) => updateForm('data_liquidacao', e.target.value)}
                  />
                  <Input
                    id="rf-vencimento"
                    label="Data de Vencimento"
                    type="date"
                    value={form.data_vencimento}
                    onChange={(e) => updateForm('data_vencimento', e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

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
        <p className="text-sm text-slate-600 mb-6">
          Tem certeza que deseja excluir este ativo? As movimentacoes vinculadas tambem precisam ser removidas antes. Essa acao nao pode ser desfeita.
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
