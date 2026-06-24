'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import {
  DollarSign,
  TrendingUp,
  Clock,
  Hash,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

interface CadastroItem { id: string; nome: string }

interface Lancamento {
  data: string
  valor: number
  status: string
  categoria_id: string | null
  classe_id: string | null
  conta_id: string | null
}

const COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
]

export default function DashboardPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [categorias, setCategorias] = useState<CadastroItem[]>([])
  const [classes, setClasses] = useState<CadastroItem[]>([])
  const [contas, setContas] = useState<CadastroItem[]>([])
  const [loading, setLoading] = useState(true)

  const [filters, setFilters] = useState({
    dataInicio: '',
    dataFim: '',
    categoria_id: '',
    classe_id: '',
    conta_id: '',
    status: '',
  })

  const supabase = createClient()

  useEffect(() => {
    async function loadCadastros() {
      const [c1, c2, c3] = await Promise.all([
        supabase.from('categorias').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('classes').select('id, nome').eq('ativo', true).order('nome'),
        supabase.from('contas').select('id, nome').eq('ativo', true).order('nome'),
      ])
      setCategorias(c1.data ?? [])
      setClasses(c2.data ?? [])
      setContas(c3.data ?? [])
    }
    loadCadastros()
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('lancamentos')
      .select('data, valor, status, categoria_id, classe_id, conta_id')

    if (filters.dataInicio) query = query.gte('data', filters.dataInicio)
    if (filters.dataFim) query = query.lte('data', filters.dataFim)
    if (filters.categoria_id) query = query.eq('categoria_id', filters.categoria_id)
    if (filters.classe_id) query = query.eq('classe_id', filters.classe_id)
    if (filters.conta_id) query = query.eq('conta_id', filters.conta_id)
    if (filters.status) query = query.eq('status', filters.status)

    const { data } = await query
    setLancamentos(data ?? [])
    setLoading(false)
  }, [filters])

  useEffect(() => {
    loadData()
  }, [loadData])

  function updateFilter(field: string, value: string) {
    setFilters((prev) => ({ ...prev, [field]: value }))
  }

  const toOptions = (items: CadastroItem[]) => items.map((i) => ({ value: i.id, label: i.nome }))

  // Calculos
  const totalGeral = lancamentos.reduce((s, l) => s + l.valor, 0)
  const totalRealizado = lancamentos.filter((l) => l.status === 'R').reduce((s, l) => s + l.valor, 0)
  const totalPrevisto = lancamentos.filter((l) => l.status === 'P').reduce((s, l) => s + l.valor, 0)
  const qtd = lancamentos.length

  // Grafico por categoria (top 10)
  const catMap = new Map<string, number>()
  lancamentos.forEach((l) => {
    if (!l.categoria_id) return
    const cat = categorias.find((c) => c.id === l.categoria_id)
    const name = cat?.nome ?? 'Outros'
    catMap.set(name, (catMap.get(name) ?? 0) + l.valor)
  })
  const barData = Array.from(catMap.entries())
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 10)

  // Grafico evolucao mensal
  const monthMap = new Map<string, number>()
  lancamentos.forEach((l) => {
    const key = l.data.slice(0, 7)
    monthMap.set(key, (monthMap.get(key) ?? 0) + l.valor)
  })
  const lineData = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }))

  // Grafico por classe (pizza)
  const classMap = new Map<string, number>()
  lancamentos.forEach((l) => {
    if (!l.classe_id) return
    const cls = classes.find((c) => c.id === l.classe_id)
    const name = cls?.nome ?? 'Outros'
    classMap.set(name, (classMap.get(name) ?? 0) + l.valor)
  })
  const pieData = Array.from(classMap.entries())
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor)

  const cards = [
    { label: 'Total Geral', value: formatCurrency(totalGeral), icon: DollarSign, color: 'bg-blue-50 text-blue-600' },
    { label: 'Realizado', value: formatCurrency(totalRealizado), icon: TrendingUp, color: 'bg-green-50 text-green-600' },
    { label: 'Previsto', value: formatCurrency(totalPrevisto), icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Lancamentos', value: qtd.toLocaleString('pt-BR'), icon: Hash, color: 'bg-purple-50 text-purple-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Input
            type="date"
            value={filters.dataInicio}
            onChange={(e) => updateFilter('dataInicio', e.target.value)}
            label="De"
          />
          <Input
            type="date"
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

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-500">Carregando...</div>
      ) : (
        <>
          {/* Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${card.color}`}>
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{card.label}</p>
                    <p className="text-lg font-semibold text-slate-900">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Graficos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Barras - por categoria */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Valor por Categoria (Top 10)</h3>
              {barData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" width={75} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Bar dataKey="valor" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>
              )}
            </div>

            {/* Pizza - por classe */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribuicao por Classe</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="valor"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>
              )}
            </div>

            {/* Linhas - evolucao mensal */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Evolucao Mensal (ultimos 12 meses)</h3>
              {lineData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: number) => formatCurrency(v)} />
                    <Legend />
                    <Line type="monotone" dataKey="valor" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
