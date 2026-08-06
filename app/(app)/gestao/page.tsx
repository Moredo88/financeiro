'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useValores } from '@/components/ValoresProvider'
import { calcularPosicoes, ehClasseRendaFixa, type AtivoCalc, type MovimentacaoCalc, type Posicao } from '@/lib/investimentos/posicao'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import ExportButton from '@/components/ui/ExportButton'
import { exportToExcel } from '@/lib/export'
import { RefreshCw, Wallet, TrendingUp, Coins, AlertTriangle } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts'

interface AtivoRow {
  id: string
  ticker: string
  nome: string | null
  status: string
  banco_corretora_id: string | null
  cotacao_atual: number | null
  saldo_devedor: number | null
  data_vencimento: string | null
  classes_ativo: { nome: string } | null
  bancos_corretoras: { nome: string } | null
}

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']
const LIMITE_CONCENTRACAO = 20

export default function GestaoPage() {
  const [ativos, setAtivos] = useState<AtivoRow[]>([])
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCalc[]>([])
  const [movimentacoesCompletas, setMovimentacoesCompletas] = useState<
    { ativo_id: string; tipo_evento: string; data_evento: string; quantidade: number | null; valor_liquido: number | null }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState(false)
  const [mensagemCotacao, setMensagemCotacao] = useState<string | null>(null)

  const { oculto, moeda } = useValores()
  const eixoValor = (v: number) => (oculto ? '' : `R$${(v / 1000).toFixed(0)}k`)

  const supabase = createClient()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [ativosRes, movRes] = await Promise.all([
      supabase
        .from('ativos')
        .select('id, ticker, nome, status, banco_corretora_id, cotacao_atual, saldo_devedor, data_vencimento, classes_ativo(nome), bancos_corretoras(nome)'),
      supabase
        .from('movimentacoes_ativos')
        .select('ativo_id, tipo_evento, data_evento, quantidade, valor_liquido'),
    ])
    setAtivos((ativosRes.data as unknown as AtivoRow[]) ?? [])
    setMovimentacoesCompletas(movRes.data ?? [])
    setMovimentacoes((movRes.data as MovimentacaoCalc[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function handleAtualizarCotacoes() {
    setAtualizando(true)
    setMensagemCotacao(null)
    try {
      const res = await fetch('/api/investimentos/atualizar-cotacoes', { method: 'POST' })
      const json = await res.json()
      setMensagemCotacao(
        json.ok ? `${json.atualizados} cotacao(oes) atualizada(s).` : (json.error ?? 'Falha ao atualizar cotacoes.')
      )
      if (json.ok) loadData()
    } catch {
      setMensagemCotacao('Falha ao atualizar cotacoes.')
    } finally {
      setAtualizando(false)
    }
  }

  const ativosCalc: AtivoCalc[] = ativos.map((a) => ({
    id: a.id,
    classe_nome: a.classes_ativo?.nome ?? null,
    cotacao_atual: a.cotacao_atual,
    saldo_devedor: a.saldo_devedor,
  }))
  const posicoes = calcularPosicoes(ativosCalc, movimentacoes)

  const posicoesAbertas = ativos
    .map((a) => ({ ativo: a, pos: posicoes.get(a.id) as Posicao }))
    .filter((p) => p.pos && Math.abs(p.pos.quantidade) > 0.0000001)

  const patrimonioTotal = posicoesAbertas.reduce((s, p) => s + p.pos.valorMercado, 0)
  const valorInvestidoTotal = posicoesAbertas.reduce((s, p) => s + p.pos.valorInvestido, 0)
  const proventosTotal = Array.from(posicoes.values()).reduce((s, p) => s + p.proventos, 0)
  const rentabilidadeTotal = valorInvestidoTotal > 0
    ? ((patrimonioTotal + proventosTotal - valorInvestidoTotal) / valorInvestidoTotal) * 100
    : 0

  const porClasseMap = new Map<string, number>()
  posicoesAbertas.forEach((p) => {
    const nome = p.ativo.classes_ativo?.nome ?? 'Sem classe'
    porClasseMap.set(nome, (porClasseMap.get(nome) ?? 0) + p.pos.valorMercado)
  })
  const porClasseData = Array.from(porClasseMap.entries())
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100 }))
    .sort((a, b) => b.valor - a.valor)

  const porCorretoraMap = new Map<string, number>()
  posicoesAbertas.forEach((p) => {
    const nome = p.ativo.bancos_corretoras?.nome ?? 'Sem corretora'
    porCorretoraMap.set(nome, (porCorretoraMap.get(nome) ?? 0) + p.pos.valorMercado)
  })
  const porCorretoraData = Array.from(porCorretoraMap.entries())
    .map(([nome, valor]) => ({ nome, valor: Math.round(valor * 100) / 100, pct: patrimonioTotal > 0 ? (valor / patrimonioTotal) * 100 : 0 }))
    .sort((a, b) => b.valor - a.valor)

  const top5 = [...posicoesAbertas].sort((a, b) => b.pos.valorMercado - a.pos.valorMercado).slice(0, 5)

  // Proventos por mes (ultimos 12 meses)
  const proventosMensaisMap = new Map<string, number>()
  movimentacoesCompletas.forEach((m) => {
    if (!['Dividendo', 'JCP', 'Rendimento', 'Cupom'].includes(m.tipo_evento)) return
    const chave = m.data_evento.slice(0, 7)
    proventosMensaisMap.set(chave, (proventosMensaisMap.get(chave) ?? 0) + (m.valor_liquido ?? 0))
  })
  const proventosMensaisData = Array.from(proventosMensaisMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([mes, valor]) => ({ mes, valor: Math.round(valor * 100) / 100 }))

  const yieldMensal = proventosMensaisData.length > 0
    ? proventosMensaisData.reduce((s, p) => s + p.valor, 0) / proventosMensaisData.length
    : 0

  // Evolucao patrimonial (fluxo liquido de compras/vendas acumulado por mes)
  const fluxoMensalMap = new Map<string, number>()
  movimentacoesCompletas.forEach((m) => {
    const chave = m.data_evento.slice(0, 7)
    const valor = m.valor_liquido ?? 0
    if (m.tipo_evento === 'Compra') fluxoMensalMap.set(chave, (fluxoMensalMap.get(chave) ?? 0) + valor)
    if (m.tipo_evento === 'Venda') fluxoMensalMap.set(chave, (fluxoMensalMap.get(chave) ?? 0) - valor)
  })
  let acumulado = 0
  const evolucaoData = Array.from(fluxoMensalMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-24)
    .map(([mes, valor]) => {
      acumulado += valor
      return { mes, acumulado: Math.round(acumulado * 100) / 100 }
    })

  // Vencimentos de Renda Fixa
  const vencimentosRF = ativos
    .filter((a) => ehClasseRendaFixa(a.classes_ativo?.nome) && a.data_vencimento)
    .sort((a, b) => (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? ''))

  const hoje = new Date()
  const em90dias = new Date(hoje.getTime() + 90 * 24 * 60 * 60 * 1000)

  // Alertas
  const ativosInativos = ativos.filter((a) => a.status === 'Inativo' || a.status === 'Liquidado')
  const concentracaoAlta = posicoesAbertas.filter((p) => {
    const pct = patrimonioTotal > 0 ? (p.pos.valorMercado / patrimonioTotal) * 100 : 0
    return pct > LIMITE_CONCENTRACAO
  })
  const vencimentosProximos = vencimentosRF.filter((a) => {
    if (!a.data_vencimento) return false
    const d = new Date(a.data_vencimento)
    return d >= hoje && d <= em90dias
  })

  async function handleExport() {
    await exportToExcel('posicao_consolidada', 'Posicao Atual', [
      { header: 'Ticker', width: 14, value: (p) => p.ativo.ticker },
      { header: 'Nome', width: 28, value: (p) => p.ativo.nome },
      { header: 'Classe', width: 18, value: (p) => p.ativo.classes_ativo?.nome },
      { header: 'Corretora', width: 18, value: (p) => p.ativo.bancos_corretoras?.nome },
      { header: 'Quantidade', width: 14, value: (p) => p.pos.quantidade },
      { header: 'Preco Medio', width: 14, value: (p) => p.pos.precoMedio },
      { header: 'Valor Investido', width: 16, value: (p) => p.pos.valorInvestido },
      { header: 'Valor de Mercado', width: 16, value: (p) => p.pos.valorMercado },
      { header: 'Proventos', width: 14, value: (p) => p.pos.proventos },
      { header: 'Rentabilidade (%)', width: 16, value: (p) => Math.round(p.pos.rentabilidade * 10000) / 100 },
      { header: '% do Patrimonio', width: 16, value: (p) => (patrimonioTotal > 0 ? Math.round((p.pos.valorMercado / patrimonioTotal) * 10000) / 100 : 0) },
    ], posicoesAbertas)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Visao consolidada da carteira de investimentos</p>
        <div className="flex items-center gap-3">
          {mensagemCotacao && <span className="text-xs text-slate-500">{mensagemCotacao}</span>}
          <ExportButton onExport={handleExport} disabled={posicoesAbertas.length === 0} label="Exportar posicao" />
          <Button variant="outline" size="sm" onClick={handleAtualizarCotacoes} loading={atualizando}>
            <RefreshCw className="h-4 w-4" />
            Atualizar cotacoes
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-slate-500">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card icon={Wallet} label="Patrimonio Total" value={moeda(patrimonioTotal)} color="bg-blue-50 text-blue-600" />
            <Card icon={TrendingUp} label="Rentabilidade" value={`${rentabilidadeTotal.toFixed(2)}%`} color="bg-green-50 text-green-600" />
            <Card icon={Coins} label="Proventos (12m)" value={moeda(proventosMensaisData.reduce((s, p) => s + p.valor, 0))} color="bg-amber-50 text-amber-600" />
            <Card icon={Coins} label="Yield mensal medio" value={moeda(yieldMensal)} color="bg-purple-50 text-purple-600" />
          </div>

          {(ativosInativos.length > 0 || concentracaoAlta.length > 0 || vencimentosProximos.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
                <AlertTriangle className="h-4 w-4" />
                Alertas
              </div>
              <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
                {ativosInativos.length > 0 && (
                  <li>{ativosInativos.length} ativo(s) Inativo/Liquidado: {ativosInativos.map((a) => a.ticker).join(', ')}</li>
                )}
                {concentracaoAlta.map((p) => (
                  <li key={p.ativo.id}>
                    {p.ativo.ticker} representa {((p.pos.valorMercado / patrimonioTotal) * 100).toFixed(1)}% do patrimonio (acima de {LIMITE_CONCENTRACAO}%)
                  </li>
                ))}
                {vencimentosProximos.map((a) => (
                  <li key={a.id}>{a.ticker} vence em {formatDate(a.data_vencimento!)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Posicao atual por ativo</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Ticker</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Classe</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Quantidade</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Preco Medio</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Valor Investido</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Valor de Mercado</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Rentabilidade</th>
                  </tr>
                </thead>
                <tbody>
                  {posicoesAbertas.length === 0 ? (
                    <tr><td colSpan={7} className="px-3 py-8 text-center text-slate-400">Sem posicoes abertas</td></tr>
                  ) : (
                    posicoesAbertas
                      .sort((a, b) => b.pos.valorMercado - a.pos.valorMercado)
                      .map((p) => (
                        <tr key={p.ativo.id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-3 py-2.5 font-medium text-slate-900">{p.ativo.ticker}</td>
                          <td className="px-3 py-2.5 text-slate-600">{p.ativo.classes_ativo?.nome}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{p.pos.quantidade.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{moeda(p.pos.precoMedio)}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{moeda(p.pos.valorInvestido)}</td>
                          <td className="px-3 py-2.5 text-right font-medium text-slate-900">{moeda(p.pos.valorMercado)}</td>
                          <td className={`px-3 py-2.5 text-right font-medium ${p.pos.rentabilidade >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {(p.pos.rentabilidade * 100).toFixed(2)}%
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Patrimonio por Classe</h3>
              {porClasseData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={porClasseData} dataKey="valor" nameKey="nome" cx="50%" cy="50%" outerRadius={90}
                      label={(props: any) => `${props.nome} ${((props.percent ?? 0) * 100).toFixed(0)}%`}>
                      {porClasseData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => moeda(v)} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Concentracao por Corretora</h3>
              {porCorretoraData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={porCorretoraData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(v) => `${v.toFixed(0)}%`} dataKey="pct" />
                    <YAxis type="category" dataKey="nome" width={75} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                    <Bar dataKey="pct" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Proventos por Mes (ultimos 12 meses)</h3>
              {proventosMensaisData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={proventosMensaisData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={eixoValor} />
                    <Tooltip formatter={(v: number) => moeda(v)} />
                    <Bar dataKey="valor" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Evolucao Patrimonial (fluxo acumulado)</h3>
              {evolucaoData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={evolucaoData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={eixoValor} />
                    <Tooltip formatter={(v: number) => moeda(v)} />
                    <Line type="monotone" dataKey="acumulado" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <p className="text-sm text-slate-400 text-center py-12">Sem dados</p>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Top 5 posicoes</h3>
              <span className="text-xs text-slate-500">Maior posicao: {top5[0]?.ativo.ticker ?? '-'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Ticker</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Valor de Mercado</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">% do Patrimonio</th>
                  </tr>
                </thead>
                <tbody>
                  {top5.length === 0 ? (
                    <tr><td colSpan={3} className="px-3 py-8 text-center text-slate-400">Sem posicoes</td></tr>
                  ) : top5.map((p) => (
                    <tr key={p.ativo.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-900">{p.ativo.ticker}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{moeda(p.pos.valorMercado)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">
                        {patrimonioTotal > 0 ? ((p.pos.valorMercado / patrimonioTotal) * 100).toFixed(1) : '0.0'}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900">Vencimentos de Renda Fixa</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Ticker</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Nome</th>
                    <th className="px-3 py-3 text-left font-medium text-slate-600">Vencimento</th>
                    <th className="px-3 py-3 text-right font-medium text-slate-600">Saldo Devedor</th>
                  </tr>
                </thead>
                <tbody>
                  {vencimentosRF.length === 0 ? (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-slate-400">Nenhum titulo de Renda Fixa com vencimento cadastrado</td></tr>
                  ) : vencimentosRF.map((a) => {
                    const proximo = vencimentosProximos.some((v) => v.id === a.id)
                    return (
                      <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-2.5 font-medium text-slate-900">{a.ticker}</td>
                        <td className="px-3 py-2.5 text-slate-600">{a.nome}</td>
                        <td className="px-3 py-2.5 text-slate-700">
                          {formatDate(a.data_vencimento!)}
                          {proximo && <Badge className="ml-2 bg-amber-100 text-amber-700">Proximo</Badge>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-700">
                          {moeda(a.saldo_devedor)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center h-10 w-10 rounded-lg ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-lg font-semibold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}
