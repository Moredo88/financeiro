'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { Pencil, Plus, ToggleLeft, ToggleRight } from 'lucide-react'

interface LookupItem { id: string; nome: string }

interface Ativo {
  id: string
  ticker: string
  nome: string | null
  classe_id: string | null
  carteira_id: string | null
  estrategia_id: string | null
  alocacao_alvo: number | null
  aporte_planejado: number | null
  recomendacao_atual: string | null
  liquidez: string | null
  retorno_12m: number | null
  preco_teto: number | null
  taxa_indexador: string | null
  tipo_juros: string | null
  amortizacao: string | null
  data_liquidacao: string | null
  data_vencimento: string | null
  saldo_devedor: number | null
  classes_ativo: { nome: string } | null
  carteiras: { nome: string } | null
  estrategias: { nome: string } | null
}

type LookupTable =
  | 'classes_ativo' | 'categorias_ativo' | 'segmentos' | 'bancos_corretoras' | 'casas_analise'
  | 'carteiras' | 'estrategias' | 'tags_exposicao'
type Section = 'ativos' | LookupTable

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'ativos', label: 'Parametros por Ativo' },
  { key: 'classes_ativo', label: 'Classes de Ativo' },
  { key: 'categorias_ativo', label: 'Categorias de Ativo' },
  { key: 'segmentos', label: 'Segmentos' },
  { key: 'bancos_corretoras', label: 'Bancos/Corretoras' },
  { key: 'casas_analise', label: 'Casas de Analise' },
  { key: 'carteiras', label: 'Carteiras' },
  { key: 'estrategias', label: 'Estrategias' },
  { key: 'tags_exposicao', label: 'Tags de Exposicao' },
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

export default function ParametrosPage() {
  const [section, setSection] = useState<Section>('ativos')
  const supabase = createClient()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              section === s.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'ativos' ? (
        <AtivosParametros supabase={supabase} />
      ) : (
        <ListaLookup key={section} table={section} supabase={supabase} />
      )}
    </div>
  )
}

function AtivosParametros({ supabase }: { supabase: ReturnType<typeof createClient> }) {
  const [ativos, setAtivos] = useState<Ativo[]>([])
  const [loading, setLoading] = useState(true)

  const [classes, setClasses] = useState<LookupItem[]>([])
  const [carteiras, setCarteiras] = useState<LookupItem[]>([])
  const [estrategias, setEstrategias] = useState<LookupItem[]>([])
  const [tags, setTags] = useState<LookupItem[]>([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editAtivo, setEditAtivo] = useState<Ativo | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [tagsSelecionadas, setTagsSelecionadas] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const loadAtivos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('ativos')
      .select('id, ticker, nome, classe_id, carteira_id, estrategia_id, alocacao_alvo, aporte_planejado, recomendacao_atual, liquidez, retorno_12m, preco_teto, taxa_indexador, tipo_juros, amortizacao, data_liquidacao, data_vencimento, saldo_devedor, classes_ativo(nome), carteiras(nome), estrategias(nome)')
      .order('ticker')
    setAtivos((data as unknown as Ativo[]) ?? [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    async function loadLookups() {
      const [c1, c2, c3, c4] = await Promise.all([
        supabase.from('classes_ativo').select('id, nome').order('nome'),
        supabase.from('carteiras').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('estrategias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('tags_exposicao').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setClasses(c1.data ?? [])
      setCarteiras(c2.data ?? [])
      setEstrategias(c3.data ?? [])
      setTags(c4.data ?? [])
    }
    loadLookups()
    loadAtivos()
  }, [supabase, loadAtivos])

  function toOptions(items: LookupItem[]) {
    return items.map((i) => ({ value: i.id, label: i.nome }))
  }

  async function openEdit(a: Ativo) {
    setEditAtivo(a)
    setForm({
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

    setModalOpen(true)
  }

  function updateForm(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function toggleTag(tagId: string) {
    setTagsSelecionadas((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    )
  }

  async function handleSave() {
    if (!editAtivo) return
    setSaving(true)

    const payload = {
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

    await supabase.from('ativos').update(payload).eq('id', editAtivo.id)

    await supabase.from('ativo_tags').delete().eq('ativo_id', editAtivo.id)
    if (tagsSelecionadas.length > 0) {
      await supabase.from('ativo_tags').insert(
        tagsSelecionadas.map((tagId) => ({ ativo_id: editAtivo.id, tag_id: tagId }))
      )
    }

    setSaving(false)
    setModalOpen(false)
    loadAtivos()
  }

  const classeSelecionada = classes.find((c) => c.id === editAtivo?.classe_id)?.nome
  const ehRendaFixa = classeSelecionada === 'Renda Fixa' || classeSelecionada === 'Estruturada'

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : ativos.length === 0 ? (
          <EmptyState title="Nenhum ativo cadastrado" description="Cadastre um ativo em Investimentos > Ativos antes de definir os parametros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Ticker</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Nome</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Classe</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Carteira</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Estrategia</th>
                  <th className="px-3 py-3 text-left font-medium text-slate-600">Recomendacao</th>
                  <th className="px-3 py-3 text-right font-medium text-slate-600 w-20">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900">{a.ticker}</td>
                    <td className="px-3 py-2.5 text-slate-700">{a.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.classes_ativo?.nome}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.carteiras?.nome ?? '-'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.estrategias?.nome ?? '-'}</td>
                    <td className="px-3 py-2.5 text-slate-600">{a.recomendacao_atual ?? '-'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => openEdit(a)}
                        className="p-1 text-slate-400 hover:text-blue-600 cursor-pointer"
                        title="Editar parametros"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
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
        title={`Parametros — ${editAtivo?.ticker ?? ''}`}
        size="lg"
      >
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
              {tags.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhuma tag cadastrada.</p>
              ) : (
                tags.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={tagsSelecionadas.includes(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                      className="rounded border-slate-300"
                    />
                    {tag.nome}
                  </label>
                ))
              )}
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

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Salvar
          </Button>
        </div>
      </Modal>
    </>
  )
}

interface LookupRow { id: string; nome: string; ativo: boolean }

function ListaLookup({ table, supabase }: { table: LookupTable; supabase: ReturnType<typeof createClient> }) {
  const [items, setItems] = useState<LookupRow[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<LookupRow | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from(table).select('id, nome, ativo').order('nome')
    setItems(data ?? [])
    setLoading(false)
  }, [supabase, table])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  function openCreate() {
    setEditItem(null)
    setNome('')
    setModalOpen(true)
  }

  function openEdit(item: LookupRow) {
    setEditItem(item)
    setNome(item.nome)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)

    if (editItem) {
      await supabase.from(table).update({ nome: nome.trim() }).eq('id', editItem.id)
    } else {
      await supabase.from(table).insert({ nome: nome.trim() })
    }

    setSaving(false)
    setModalOpen(false)
    loadItems()
  }

  async function toggleAtivo(item: LookupRow) {
    await supabase.from(table).update({ ativo: !item.ativo }).eq('id', item.id)
    loadItems()
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-4">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum registro" description="Clique em Novo para adicionar." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 w-28">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 w-32">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{item.nome}</td>
                  <td className="px-4 py-3">
                    <Badge className={item.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleAtivo(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                        title={item.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {item.ativo ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar' : 'Novo'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            id="nome"
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite o nome..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
