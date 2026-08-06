'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useValores } from '@/components/ValoresProvider'
import { calcularPosicoes, type AtivoCalc, type MovimentacaoCalc } from '@/lib/investimentos/posicao'
import MultiSelect from '@/components/ui/MultiSelect'
import ExportButton from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/export'
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface LookupItem { id: string; nome: string }

interface AtivoRow {
  id: string
  ticker: string
  classe_id: string | null
  carteira_id: string | null
  banco_corretora_id: string | null
  segmento_id: string | null
  casa_analise_id: string | null
  estrategia_id: string | null
  alocacao_alvo: number | null
  aporte_planejado: number | null
  recomendacao_atual: string | null
  cotacao_atual: number | null
  saldo_devedor: number | null
  classes_ativo: { nome: string } | null
  segmentos: { nome: string } | null
  casas_analise: { nome: string } | null
  estrategias: { nome: string } | null
}

interface AtivoTagRow {
  ativo_id: string
  tags_exposicao: { nome: string } | null
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6']

function groupSum(entries: { chave: string; valor: number }[]) {
  const map = new Map<string, number>()
  entries.forEach(({ chave, valor }) => map.set(chave, (map.get(chave) ?? 0) + valor))
  return Array.from(map.entries())
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor)
}

export default function EstrategiaPage() {
  const [ativos, setAtivos] = useState<AtivoRow[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCalc[]>([])
  const [ativoTags, setAtivoTags] = useState<AtivoTagRow[]>([])
  const [aportesRealizados, setAportesRealizados] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)

  const [carteiras, setCarteiras] = useState<LookupItem[]>([])
  const [classes, setClasses] = useState<LookupItem[]>([])
  const [bancos, setBancos] = useState<LookupItem[]>([])

  const [filters, setFilters] = useState({
    carteira_id: [] as string[],
    classe_id: [] as string[],
    banco_corretora_id: [] as string[],
  })

  const { oculto, moeda } = useValores()
  const eixoValor = (v: number) => (oculto ? '' : `R$${(v / 1000).toFixed(0)}k`)

  const supabase = createClient()

  useEffect(() => {
    async function loadLookups() {
      const [c, cl, b] = await Promise.all([
        supabase.from('carteiras').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('classes_ativo').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('bancos_corretoras').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setCarteiras(c.data ?? [])
      setClasses(cl.data ?? [])
      setBancos(b.data ?? [])
    }
    loadLookups()
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)

    let ativosQuery = supabase
      .from('ativos')
      .select('id, ticker, classe_id, carteira_id, banco_corretora_id, segmento_id, casa_analise_id, estrategia_id, alocacao_alvo, aporte_planejado, recomendacao_atual, cotacao_atual, saldo_devedor, classes_ativo(nome), segmentos(nome), casas_analise(nome), estrategias(nome)')

    if (filters.carteira_id.length > 0) ativosQuery = ativosQuery.in('carteira_id', filters.carteira_id)
    if (filters.classe_id.length > 0) ativosQuery = ativosQuery.in('classe_id', filters.classe_id)
    if (filters.banco_corretora_id.length > 0) ativosQuery = ativosQuery.in('banco_corretora_id', filters.banco_corretora_id)

    const [ativosRes, movRes, tagsRes] = await Promise.all([
      ativosQuery,
      supabase.from('movimentacoes_ativos').select('ativo_id, tipo_evento, quantidade, valor_liquido'),
      supabase.from('ativo_tags').select('ativo_id, tags_exposicao(nome)'),
    ])

    const ativosData = (ativosRes.data as unknown as AtivoRow[]) ?? []
    setAtivos(ativosData)
    setMovimentacoes((movRes.data as MovimentacaoCalc[]) ?? [])
    setAtivoTags((tagsRes.data as unknown as AtivoTagRow[]) ?? [])

    const aportesMap = new Map<string, number>()
    for (const m of (movRes.data as { ativo_id: string; tipo_evento: string; valor_liquido: number | null }[]) ?? []) {
      if (m.tipo_evento === 'Compra') {
        aportesMap.set(m.ativo_id, (aportesMap.get(m.ativo_id) ?? 0) + (m.valor_liquido ?? 0))
      }
    }
    setAportesRealizados(aportesMap)

    setLoading(false)
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  function updateFilter(field: string, values: string[]) {
    setFilters((prev) => ({ ...prev, [field]: values }))
  }

  const ativosCalc: AtivoCalc[] = ativos.map((a) => ({
    id: a.id,
    classe_nome: a.classes_ativo?.nome ?? null,
    cotacao_atual: a.cotacao_atual,
    saldo_devedor: a.saldo_devedor,
  }))
  const posicoes = calcularPosicoes(ativosCalc, movimentacoes)
  const totalCarteira = Array.from(posicoes.values()).reduce((s, p) => s + p.valorInvestido, 0)

  function valorDe(ativoId: string) {
    return posicoes.get(ativoId)?.valorInvestido ?? 0
  }

  const porEstrategia = groupSum(ativos.map((a) => ({ chave: a.estrategias?.nome ?? 'Sem estrategia', valor: valorDe(a.id) })))
  const porClasse = groupSum(ativos.map((a) => ({ chave: a.classes_ativo?.nome ?? 'Sem classe', valor: valorDe(a.id) })))
  const porSegmento = groupSum(ativos.map((a) => ({ chave: a.segmentos?.nome ?? 'Sem segmento', valor: valorDe(a.id) })))
  const porCasaAnalise = groupSum(ativos.map((a) => ({ chave: a.casas_analise?.nome ?? 'Sem casa', valor: valorDe(a.id) })))

  const porTag = groupSum(
    ativoTags
      .filter((t) => t.tags_exposicao)
      .map((t) => ({ chave: t.tags_exposicao!.nome, valor: valorDe(t.ativo_id) }))
  )

  const alocacaoData = ativos
    .filter((a) => a.alocacao_alvo != null)
    .map((a) => {
      const alvo = a.alocacao_alvo ?? 0
      const real = totalCarteira > 0 ? (valorDe(a.id) / totalCarteira) * 100 : 0
      return { nome: a.ticker, alvo: Math.round(alvo * 100) / 100, real: Math.round(real * 100) / 100, gap: Math.abs(alvo - real) }
    })
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 10)

  const aportesData = ativos
    .filter((a) => a.aporte_planejado != null)
    .map((a) => ({
      nome: a.ticker,
      planejado: Math.round((a.aporte_planejado ?? 0) * 100) / 100,
      realizado: Math.round((aportesRealizados.get(a.id) ?? 0) * 100) / 100,
    }))
    .sort((a, b) => b.planejado - a.planejado)
    .slice(0, 10)

  const recomendacaoMap = new Map<string, number>()
  ativos.forEach((a) => {
    const key = a.recomendacao_atual ?? 'N/A'
    recomendacaoMap.set(key, (recomendacaoMap.get(key) ?? 0) + 1)
  })
  const recomendacaoData = Array.from(recomendacaoMap.entries()).map(([nome, qtd]) => ({ nome, qtd }))

  async function handleExport() {
    // Uma linha por ativo, com o detalhamento que alimenta os graficos.
    await exportToExcel('estrategia', 'Estrategia', [
      { header: 'Ticker', width: 14, value: (a) => a.ticker },
      { header: 'Classe', width: 18, value: (a) => a.classes_ativo?.nome },
      { header: 'Estrategia', width: 18, value: (a) => a.estrategias?.nome },
      { header: 'Segmento', width: 24, value: (a) => a.segmentos?.nome },
      { header: 'Casa de Analise', width: 20, value: (a) => a.casas_analise?.nome },
      { header: 'Recomendacao', width: 16, value: (a) => a.recomendacao_atual },
      { header: 'Valor Investido', width: 16, value: (a) => valorDe(a.id) },
      { header: 'Alocacao Real (%)', width: 18, value: (a) => (totalCarteira > 0 ? Math.round((valorDe(a.id) / totalCarteira) * 10000) / 100 : 0) },
      { header: 'Alocacao-alvo (%)', width: 18, value: (a) => a.alocacao_alvo },
      { header: 'Aporte Planejado', width: 18, value: (a) => a.aporte_planejado },
      { header: 'Aporte Realizado', width: 18, value: (a) => aportesRealizados.get(a.id) ?? 0 },
      {
        header: 'Tags',
        width: 20,
        value: (a) => ativoTags.filter((t) => t.ativo_id === a.id && t.tags_exposicao).map((t) => t.tags_exposicao!.nome).join(', '),
      },
    ], ativos)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ExportButton onExport={handleExport} disabled={ativos.length === 0} />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MultiSelect
            label="Carteira"
            options={carteiras.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Todas"
            values={filters.carteira_id}
            onChange={(values) => updateFilter('carteira_id', values)}
          />
          <MultiSelect
            label="Classe"
            options={classes.map((c) => ({ value: c.id, label: c.nome }))}
            placeholder="Todas"
            values={filters.classe_id}
            onChange={(values) => updateFilter('classe_id', values)}
          />
          <MultiSelect
            label="Corretora"
            options={bancos.map((b) => ({ value: b.id, label: b.nome }))}
            placeholder="Todas"
            values={filters.banco_corretora_id}
            onChange={(values) => updateFilter('banco_corretora_id', values)}
          />
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-500">Carregando...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Distribuicao por Estrategia">
            <PizzaOuVazio data={porEstrategia} />
          </ChartCard>

          <ChartCard title="Distribuicao por Classe">
            <PizzaOuVazio data={porClasse} />
          </ChartCard>

          <ChartCard title="Distribuicao por Segmento/Setor">
            <PizzaOuVazio data={porSegmento} />
          </ChartCard>

          <ChartCard title="Distribuicao por Casa de Analise">
            <PizzaOuVazio data={porCasaAnalise} />
          </ChartCard>

          <ChartCard title="Exposicao por Tag">
            <PizzaOuVazio data={porTag} />
          </ChartCard>

          <ChartCard title="Ranking de Recomendacoes">
            {recomendacaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={recomendacaoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="qtd" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <SemDados />}
          </ChartCard>

          <ChartCard title="Alocacao-alvo vs. Real (maiores gaps)" span>
            {alocacaoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={alocacaoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Bar dataKey="alvo" name="Alvo" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="real" name="Real" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <SemDados />}
          </ChartCard>

          <ChartCard title="Aportes: Planejado vs. Realizado" span>
            {aportesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={aportesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={eixoValor} />
                  <Tooltip formatter={(v: number) => moeda(v)} />
                  <Legend />
                  <Bar dataKey="planejado" name="Planejado" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="realizado" name="Realizado" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <SemDados />}
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function ChartCard({ title, children, span }: { title: string; children: React.ReactNode; span?: boolean }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 p-5 ${span ? 'lg:col-span-2' : ''}`}>
      <h3 className="text-sm font-semibold text-slate-900 mb-4">{title}</h3>
      {children}
    </div>
  )
}

function SemDados() {
  return <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>
}

function PizzaOuVazio({ data }: { data: { nome: string; valor: number }[] }) {
  const { moeda } = useValores()
  if (data.length === 0) return <SemDados />
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="valor"
          nameKey="nome"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(props: any) => `${props.nome} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v: number) => moeda(v)} />
      </PieChart>
    </ResponsiveContainer>
  )
}
