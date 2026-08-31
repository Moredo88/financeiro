'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useValores } from '@/components/ValoresProvider'
import { renderRelatorioHtml } from '@/lib/relatorio/template'
import type { RelatorioData, RelatorioNarrativa } from '@/lib/relatorio/types'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Input from '@/components/ui/Input'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'
import { FileText, Trash2, Download, Eye, Sparkles } from 'lucide-react'

interface FechamentoOpcao {
  id: string
  competencia: string
  status: string
}

interface RelatorioSalvo {
  id: string
  fechamento_id: string
  competencia: string
  patrimonio_ajustado: number
  benchmarks: Record<string, unknown> | null
  dados: RelatorioData
  narrativa: RelatorioNarrativa
  gerado_em: string
}

interface BenchmarksManuais {
  ibovespaVar12m: string
  ifixVar12m: string
  tesouroIpcaTaxa: string
  tesouroPreTaxa: string
}

const BENCHMARKS_VAZIOS: BenchmarksManuais = {
  ibovespaVar12m: '',
  ifixVar12m: '',
  tesouroIpcaTaxa: '',
  tesouroPreTaxa: '',
}

function rotuloCompetencia(iso: string) {
  const [ano, mes] = iso.split('-')
  const nomes = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`
}

export default function RelatorioCarteiraPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-sm text-slate-500">Carregando...</div>}>
      <RelatorioCarteiraConteudo />
    </Suspense>
  )
}

function RelatorioCarteiraConteudo() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const { oculto, moeda } = useValores()

  const [fechamentos, setFechamentos] = useState<FechamentoOpcao[]>([])
  const [relatorios, setRelatorios] = useState<RelatorioSalvo[]>([])
  const [carregandoLista, setCarregandoLista] = useState(true)

  const [modalAberto, setModalAberto] = useState(false)
  const [fechamentoId, setFechamentoId] = useState('')
  const [benchmarksModo, setBenchmarksModo] = useState<'manual' | 'auto'>('manual')
  const [benchmarksManual, setBenchmarksManual] = useState<BenchmarksManuais>(BENCHMARKS_VAZIOS)
  const [gerando, setGerando] = useState(false)
  const [erroGeracao, setErroGeracao] = useState<string | null>(null)
  const [avisosBenchmarks, setAvisosBenchmarks] = useState<string[]>([])

  const [previa, setPrevia] = useState<{ html: string; dados: RelatorioData; narrativa: RelatorioNarrativa; benchmarks: unknown } | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [visualizando, setVisualizando] = useState<RelatorioSalvo | null>(null)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  const carregarLista = useCallback(async () => {
    setCarregandoLista(true)
    const [fRes, rRes] = await Promise.all([
      supabase.from('fechamentos').select('id, competencia, status').eq('status', 'Fechado').order('competencia', { ascending: false }),
      supabase
        .from('relatorios_investimentos')
        .select('id, fechamento_id, competencia, patrimonio_ajustado, benchmarks, dados, narrativa, gerado_em')
        .order('competencia', { ascending: false }),
    ])
    setFechamentos(fRes.data ?? [])
    setRelatorios((rRes.data ?? []) as RelatorioSalvo[])
    setCarregandoLista(false)
  }, [supabase])

  useEffect(() => {
    carregarLista()
  }, [carregarLista])

  // Deep link ?ver=<id> — so depois da lista carregar, para achar o relatorio.
  useEffect(() => {
    const ver = searchParams.get('ver')
    if (!ver || carregandoLista) return
    const r = relatorios.find((x) => x.id === ver)
    if (r) {
      setVisualizando(r)
      setPrevia(null)
    }
  }, [searchParams, relatorios, carregandoLista])

  const relatorioPorFechamento = useMemo(() => {
    const map = new Map<string, RelatorioSalvo>()
    for (const r of relatorios) map.set(r.fechamento_id, r)
    return map
  }, [relatorios])

  function abrirModal() {
    setErroGeracao(null)
    setAvisosBenchmarks([])
    const primeiroSemRelatorio = fechamentos.find((f) => !relatorioPorFechamento.has(f.id))
    setFechamentoId(primeiroSemRelatorio?.id ?? fechamentos[0]?.id ?? '')
    // Pre-preenche com os benchmarks do ultimo relatorio salvo, pra so precisar conferir.
    const ultimo = relatorios[0]
    const b = ultimo?.benchmarks as Record<string, number | null> | null
    setBenchmarksManual({
      ibovespaVar12m: b?.ibovespaVar12m != null ? String(b.ibovespaVar12m) : '',
      ifixVar12m: b?.ifixVar12m != null ? String(b.ifixVar12m) : '',
      tesouroIpcaTaxa: b?.tesouroIpcaTaxa != null ? String(b.tesouroIpcaTaxa) : '',
      tesouroPreTaxa: b?.tesouroPreTaxa != null ? String(b.tesouroPreTaxa) : '',
    })
    setBenchmarksModo('manual')
    setModalAberto(true)
  }

  async function gerar() {
    if (!fechamentoId) return
    setGerando(true)
    setErroGeracao(null)
    try {
      const res = await fetch('/api/investimentos/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'gerar',
          fechamentoId,
          benchmarksModo,
          benchmarksManual:
            benchmarksModo === 'manual'
              ? {
                  ibovespaVar12m: parseNumeroOuNull(benchmarksManual.ibovespaVar12m),
                  ifixVar12m: parseNumeroOuNull(benchmarksManual.ifixVar12m),
                  tesouroIpcaTaxa: parseNumeroOuNull(benchmarksManual.tesouroIpcaTaxa),
                  tesouroPreTaxa: parseNumeroOuNull(benchmarksManual.tesouroPreTaxa),
                }
              : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroGeracao(data.error ?? 'Falha ao gerar o relatório.')
        return
      }
      setPrevia({ html: data.html, dados: data.dados, narrativa: data.narrativa, benchmarks: data.dados.limiares })
      setAvisosBenchmarks(data.benchmarksFalhasBCB ?? [])
      setVisualizando(null)
      setModalAberto(false)
    } catch {
      setErroGeracao('Não foi possível falar com o servidor. Verifique sua conexão.')
    } finally {
      setGerando(false)
    }
  }

  async function salvarPrevia() {
    if (!previa) return
    const jaExiste = relatorioPorFechamento.has(fechamentoId)
    if (jaExiste && !window.confirm('Já existe um relatório salvo para este mês. Substituir pelo que está na prévia?')) {
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/investimentos/relatorio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'salvar',
          fechamentoId,
          competencia: previa.dados.competencia,
          patrimonioAjustado: previa.dados.patrimonioAjustado,
          html: previa.html,
          dados: previa.dados,
          narrativa: previa.narrativa,
          benchmarks: previa.benchmarks,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErroGeracao(data.error ?? 'Falha ao salvar.')
        return
      }
      setPrevia(null)
      await carregarLista()
      router.replace(`/relatorio-carteira?ver=${data.id}`)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(r: RelatorioSalvo) {
    if (!window.confirm(`Excluir o relatório de ${rotuloCompetencia(r.competencia)}? Não dá para desfazer.`)) return
    const { error } = await supabase.from('relatorios_investimentos').delete().eq('id', r.id)
    if (error) {
      window.alert('Falha ao excluir: ' + error.message)
      return
    }
    if (visualizando?.id === r.id) {
      setVisualizando(null)
      router.replace('/relatorio-carteira')
    }
    await carregarLista()
  }

  function baixarPdf() {
    iframeRef.current?.contentWindow?.print()
  }

  function verHistorico(r: RelatorioSalvo) {
    setPrevia(null)
    setVisualizando(r)
    router.replace(`/relatorio-carteira?ver=${r.id}`)
  }

  function fecharVisualizacao() {
    setVisualizando(null)
    setPrevia(null)
    router.replace('/relatorio-carteira')
  }

  const htmlAtual = previa
    ? renderRelatorioHtml(previa.dados, previa.narrativa, { ocultarValores: oculto })
    : visualizando
      ? renderRelatorioHtml(visualizando.dados, visualizando.narrativa, { ocultarValores: oculto })
      : null

  if (htmlAtual) {
    return (
      <div className="flex flex-col h-[calc(100vh-9rem)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {previa ? 'Prévia do relatório — ainda não salva' : `Relatório de ${rotuloCompetencia(visualizando!.competencia)}`}
            </h2>
            {previa && <p className="text-xs text-slate-500 mt-0.5">Confira antes de salvar no histórico.</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={baixarPdf}>
              <Download className="h-4 w-4" />
              Baixar PDF
            </Button>
            {previa && (
              <Button size="sm" onClick={salvarPrevia} loading={salvando}>
                Salvar no histórico
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fecharVisualizacao}>
              Fechar
            </Button>
          </div>
        </div>
        {avisosBenchmarks.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            Benchmarks do Banco Central indisponíveis neste mês: {avisosBenchmarks.join(', ')}.
          </div>
        )}
        <iframe ref={iframeRef} srcDoc={htmlAtual} className="flex-1 w-full rounded-xl border border-slate-200 bg-white" title="Relatório de carteira" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">Histórico mensal do relatório executivo de investimentos.</p>
        <Button onClick={abrirModal} disabled={fechamentos.length === 0}>
          <Sparkles className="h-4 w-4" />
          Gerar relatório
        </Button>
      </div>

      {erroGeracao && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erroGeracao}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {carregandoLista ? (
          <div className="text-center py-12 text-sm text-slate-500">Carregando...</div>
        ) : relatorios.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-12 w-12" />}
            title="Nenhum relatório salvo ainda"
            description={
              fechamentos.length === 0
                ? 'Feche um mês em Saldos Mensais antes de gerar o primeiro relatório.'
                : 'Clique em "Gerar relatório" para criar o primeiro.'
            }
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Competência</th>
                <th className="px-5 py-3 font-medium text-right">Patrimônio ajustado</th>
                <th className="px-5 py-3 font-medium">Gerado em</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {relatorios.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-900">{rotuloCompetencia(r.competencia)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{moeda(r.patrimonio_ajustado)}</td>
                  <td className="px-5 py-3 text-slate-500">{formatDate(r.gerado_em)}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => verHistorico(r)}>
                        <Eye className="h-4 w-4" />
                        Ver
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => excluir(r)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title="Gerar relatório do mês" size="md">
        <div className="space-y-4">
          <Select
            label="Competência"
            value={fechamentoId}
            onChange={(e) => setFechamentoId(e.target.value)}
            options={fechamentos.map((f) => ({
              value: f.id,
              label: rotuloCompetencia(f.competencia) + (relatorioPorFechamento.has(f.id) ? ' (já tem relatório salvo)' : ''),
            }))}
          />

          <div>
            <p className="text-sm font-medium text-slate-700 mb-1.5">Ibovespa, IFIX e taxas do Tesouro</p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setBenchmarksModo('manual')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm cursor-pointer ${benchmarksModo === 'manual' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}
              >
                Informar manualmente
              </button>
              <button
                type="button"
                onClick={() => setBenchmarksModo('auto')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm cursor-pointer ${benchmarksModo === 'auto' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}
              >
                IA pesquisa na web
              </button>
            </div>

            {benchmarksModo === 'manual' ? (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Ibovespa (var. 12m, %)"
                  type="number"
                  step="0.01"
                  value={benchmarksManual.ibovespaVar12m}
                  onChange={(e) => setBenchmarksManual((b) => ({ ...b, ibovespaVar12m: e.target.value }))}
                />
                <Input
                  label="IFIX (var. 12m, %)"
                  type="number"
                  step="0.01"
                  value={benchmarksManual.ifixVar12m}
                  onChange={(e) => setBenchmarksManual((b) => ({ ...b, ifixVar12m: e.target.value }))}
                />
                <Input
                  label="Tesouro IPCA+ (taxa, %)"
                  type="number"
                  step="0.01"
                  value={benchmarksManual.tesouroIpcaTaxa}
                  onChange={(e) => setBenchmarksManual((b) => ({ ...b, tesouroIpcaTaxa: e.target.value }))}
                />
                <Input
                  label="Tesouro Prefixado (taxa, %)"
                  type="number"
                  step="0.01"
                  value={benchmarksManual.tesouroPreTaxa}
                  onChange={(e) => setBenchmarksManual((b) => ({ ...b, tesouroPreTaxa: e.target.value }))}
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                A IA pesquisa os quatro números na web antes de gerar o relatório. Mais lento e sujeito a não achar a fonte certa —
                confira o resultado na prévia antes de salvar.
              </p>
            )}
            <p className="text-xs text-slate-400 mt-2">Selic, CDI, IPCA e dólar são buscados automaticamente do Banco Central.</p>
          </div>

          {erroGeracao && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{erroGeracao}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={gerar} loading={gerando} disabled={!fechamentoId}>
              Gerar relatório
            </Button>
          </div>
          {gerando && <p className="text-xs text-slate-500 text-center">Isso pode levar um minuto ou mais — a IA está lendo a carteira inteira.</p>}
        </div>
      </Modal>
    </div>
  )
}

function parseNumeroOuNull(s: string): number | null {
  if (s.trim() === '') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
