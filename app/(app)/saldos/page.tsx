'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { useValores } from '@/components/ValoresProvider'
import {
  competenciaDe,
  primeiroDiaUtil,
  proximaCompetencia,
  rendimentoDe,
  rentabilidadeDe,
  rotuloCompetencia,
  totaisDoPeriodo,
  type Fechamento,
  type MovimentoPeriodo,
  type OrigemSaldo,
} from '@/lib/investimentos/saldos'
import { lerExtratoB3, type LinhaB3, type ResultadoImport } from '@/lib/investimentos/importB3'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ExportButton from '@/components/ui/ExportButton'
import { Th, useOrdenacao, ordenarPor } from '@/components/ui/Ordenacao'
import { exportToExcel } from '@/lib/export'
import {
  CalendarPlus, Upload, Copy, Calculator, Save, Lock, Unlock, CalendarCheck, AlertTriangle,
} from 'lucide-react'

interface AtivoRow {
  id: string
  ticker: string
  nome: string | null
  status: string
  classes_ativo: { nome: string } | null
  categorias_ativo: { nome: string } | null
  bancos_corretoras: { nome: string } | null
}

interface SaldoRow {
  id: string
  fechamento_id: string
  ativo_id: string
  quantidade: number | null
  saldo: number
  aportes_mes: number
  resgates_mes: number
  proventos_mes: number
  origem: OrigemSaldo
}

/** Estado editavel de uma linha da grade. Texto, para o campo aceitar digitacao. */
interface Edicao {
  quantidade: string
  saldo: string
  aportes: string
  resgates: string
  proventos: string
  origem: OrigemSaldo
}

const EDICAO_VAZIA: Edicao = {
  quantidade: '',
  saldo: '',
  aportes: '0',
  resgates: '0',
  proventos: '0',
  origem: 'Manual',
}

const CORES_ORIGEM: Record<OrigemSaldo, string> = {
  B3: 'bg-blue-100 text-blue-700',
  Manual: 'bg-slate-100 text-slate-700',
  Repetido: 'bg-amber-100 text-amber-700',
}

const CORES_SITUACAO: Record<string, string> = {
  Casado: 'bg-green-100 text-green-700',
  CorretoraDivergente: 'bg-amber-100 text-amber-700',
  Ambiguo: 'bg-amber-100 text-amber-700',
  SemPar: 'bg-red-100 text-red-700',
}

const ROTULO_SITUACAO: Record<string, string> = {
  Casado: 'Casado',
  CorretoraDivergente: 'Corretora difere',
  Ambiguo: 'Ambiguo',
  SemPar: 'Sem par',
}

/** Aceita "1.234,56" e "1234.56". Vazio vira null. */
function paraNumero(texto: string): number | null {
  const t = texto.trim()
  if (!t) return null
  const limpo = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(limpo)
  return Number.isFinite(n) ? n : null
}

/**
 * Formata para dentro do campo de edicao. Sem separador de milhar de
 * proposito: "1.000" sem virgula seria lido de volta como 1, ja que um
 * ponto sozinho e ponto decimal em ingles.
 */
function paraTexto(valor: number | null | undefined, casas = 2): string {
  if (valor == null) return ''
  return valor.toLocaleString('pt-BR', {
    useGrouping: false,
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })
}

export default function SaldosPage() {
  const [feriados, setFeriados] = useState<Set<string>>(new Set())
  const [ativos, setAtivos] = useState<AtivoRow[]>([])
  const [fechamentos, setFechamentos] = useState<Fechamento[]>([])
  const [fechamentoId, setFechamentoId] = useState('')

  const [saldos, setSaldos] = useState<SaldoRow[]>([])
  const [saldosAnteriores, setSaldosAnteriores] = useState<Map<string, number>>(new Map())
  const [movimentacoes, setMovimentacoes] = useState<MovimentoPeriodo[]>([])

  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({})
  const [sujo, setSujo] = useState(false)

  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  const [modalNovo, setModalNovo] = useState(false)
  const [novaCompetencia, setNovaCompetencia] = useState('')

  const [importacao, setImportacao] = useState<ResultadoImport | null>(null)
  const [linhasImport, setLinhasImport] = useState<LinhaB3[]>([])
  const [lendoArquivo, setLendoArquivo] = useState(false)
  const inputArquivo = useRef<HTMLInputElement>(null)

  const { moeda } = useValores()
  const supabase = createClient()

  const fechamento = fechamentos.find((f) => f.id === fechamentoId) ?? null
  const fechado = fechamento?.status === 'Fechado'

  // O anterior e o de maior competencia abaixo da atual — nao necessariamente
  // o mes imediatamente anterior, ja que pode haver buraco no historico.
  const fechamentoAnterior = useMemo(() => {
    if (!fechamento) return null
    return (
      fechamentos
        .filter((f) => f.competencia < fechamento.competencia)
        .sort((a, b) => b.competencia.localeCompare(a.competencia))[0] ?? null
    )
  }, [fechamentos, fechamento])

  // ---------- carga ----------

  useEffect(() => {
    async function carregarBase() {
      const [fer, atv, fec] = await Promise.all([
        supabase.from('feriados').select('data'),
        supabase
          .from('ativos')
          .select('id, ticker, nome, status, classes_ativo(nome), categorias_ativo(nome), bancos_corretoras(nome)')
          .order('ticker'),
        supabase.from('fechamentos').select('*').order('competencia', { ascending: false }),
      ])

      setFeriados(new Set((fer.data ?? []).map((f: { data: string }) => f.data)))
      setAtivos((atv.data as unknown as AtivoRow[]) ?? [])

      const lista = (fec.data as Fechamento[]) ?? []
      setFechamentos(lista)
      setFechamentoId((atual) => atual || lista[0]?.id || '')
      setLoading(false)
    }
    carregarBase()
  }, [])

  const carregarFechamento = useCallback(async () => {
    if (!fechamento) {
      setSaldos([])
      setEdicoes({})
      setSaldosAnteriores(new Map())
      return
    }

    const anteriorId = fechamentos
      .filter((f) => f.competencia < fechamento.competencia)
      .sort((a, b) => b.competencia.localeCompare(a.competencia))[0]?.id

    const [atual, anterior, movs] = await Promise.all([
      supabase.from('saldos_mensais').select('*').eq('fechamento_id', fechamento.id),
      anteriorId
        ? supabase.from('saldos_mensais').select('ativo_id, saldo').eq('fechamento_id', anteriorId)
        : Promise.resolve({ data: [] }),
      supabase
        .from('movimentacoes_ativos')
        .select('ativo_id, tipo_evento, data_evento, valor_liquido'),
    ])

    const linhas = (atual.data as SaldoRow[]) ?? []
    setSaldos(linhas)
    setSaldosAnteriores(
      new Map(((anterior.data as { ativo_id: string; saldo: number }[]) ?? []).map((s) => [s.ativo_id, s.saldo]))
    )
    setMovimentacoes((movs.data as MovimentoPeriodo[]) ?? [])

    const mapa: Record<string, Edicao> = {}
    for (const l of linhas) {
      mapa[l.ativo_id] = {
        quantidade: l.quantidade != null ? paraTexto(l.quantidade, 8).replace(/,?0+$/, '') : '',
        saldo: paraTexto(l.saldo),
        aportes: paraTexto(l.aportes_mes),
        resgates: paraTexto(l.resgates_mes),
        proventos: paraTexto(l.proventos_mes),
        origem: l.origem,
      }
    }
    setEdicoes(mapa)
    setSujo(false)
  }, [fechamento, fechamentos])

  useEffect(() => {
    carregarFechamento()
  }, [carregarFechamento])

  // ---------- grade ----------

  // Todo ativo em situacao Ativo entra, mais qualquer um que ja tenha saldo
  // gravado neste fechamento (um ativo liquidado depois nao some do historico).
  const comSaldo = new Set(saldos.map((s) => s.ativo_id))
  const ativosDaGrade = ativos.filter((a) => a.status === 'Ativo' || comSaldo.has(a.id))

  const edicaoDe = (ativoId: string): Edicao => edicoes[ativoId] ?? EDICAO_VAZIA

  function alterar(ativoId: string, campo: keyof Edicao, valor: string) {
    setEdicoes((prev) => {
      const atual = prev[ativoId] ?? EDICAO_VAZIA
      // Digitar o saldo na mao passa a origem para Manual: o numero deixou
      // de ser o que a B3 mandou ou o que foi repetido do mes anterior.
      const origem: OrigemSaldo = campo === 'saldo' ? 'Manual' : atual.origem
      return { ...prev, [ativoId]: { ...atual, [campo]: valor, origem } }
    })
    setSujo(true)
  }

  const linhasGrade = ativosDaGrade.map((a) => {
    const e = edicaoDe(a.id)
    const saldo = paraNumero(e.saldo)
    const anterior = saldosAnteriores.get(a.id) ?? null
    const aportes = paraNumero(e.aportes) ?? 0
    const resgates = paraNumero(e.resgates) ?? 0
    const rendimento =
      saldo == null
        ? null
        : rendimentoDe({
            saldo,
            saldo_anterior: anterior,
            aportes_mes: aportes,
            resgates_mes: resgates,
            proventos_mes: paraNumero(e.proventos) ?? 0,
          })
    const rentabilidade = rentabilidadeDe({ saldo_anterior: anterior, aportes_mes: aportes, resgates_mes: resgates, rendimento })
    return { ativo: a, edicao: e, saldo, anterior, rendimento, rentabilidade }
  })

  const preenchidas = linhasGrade.filter((l) => l.saldo != null)
  const pendentes = linhasGrade.filter((l) => l.saldo == null)
  const totalSaldo = preenchidas.reduce((s, l) => s + (l.saldo ?? 0), 0)
  const totalRendimento = preenchidas.reduce((s, l) => s + (l.rendimento ?? 0), 0)
  const totalBase = preenchidas.reduce(
    (s, l) => s + (l.anterior ?? 0) + (paraNumero(l.edicao.aportes) ?? 0) - (paraNumero(l.edicao.resgates) ?? 0),
    0
  )
  const totalRentabilidade = fechamentoAnterior && totalBase > 0 ? totalRendimento / totalBase : null
  const porOrigem = (o: OrigemSaldo) => preenchidas.filter((l) => l.edicao.origem === o).length

  const ord = useOrdenacao({ campo: 'ticker', direcao: 'asc' })
  const linhasOrdenadas = ordenarPor(linhasGrade, ord.ordem, (l, campo) => {
    switch (campo) {
      case 'ticker': return l.ativo.ticker
      case 'nome': return l.ativo.nome
      case 'classe': return l.ativo.classes_ativo?.nome
      case 'categoria': return l.ativo.categorias_ativo?.nome
      case 'corretora': return l.ativo.bancos_corretoras?.nome
      case 'anterior': return l.anterior
      case 'saldo': return l.saldo
      case 'rendimento': return l.rendimento
      case 'rentabilidade': return l.rentabilidade
      case 'origem': return l.saldo == null ? null : l.edicao.origem
      default: return null
    }
  })

  // ---------- acoes ----------

  function abrirModalNovo() {
    const ultima = fechamentos[0]?.competencia
    const sugerida = ultima ? proximaCompetencia(ultima) : competenciaDe(new Date().toISOString().slice(0, 10))
    setNovaCompetencia(sugerida.slice(0, 7))
    setModalNovo(true)
  }

  async function criarFechamento() {
    const competencia = `${novaCompetencia}-01`
    const dataPosicao = primeiroDiaUtil(competencia, feriados)

    const { data, error } = await supabase
      .from('fechamentos')
      .insert({ competencia, data_posicao: dataPosicao })
      .select()
      .single()

    if (error) {
      setMensagem({
        tipo: 'erro',
        texto: error.code === '23505' ? 'Ja existe fechamento para essa competencia.' : error.message,
      })
      return
    }

    setFechamentos((prev) => [data as Fechamento, ...prev].sort((a, b) => b.competencia.localeCompare(a.competencia)))
    setFechamentoId((data as Fechamento).id)
    setModalNovo(false)
    setMensagem({ tipo: 'ok', texto: `Fechamento de ${rotuloCompetencia(competencia)} aberto em ${formatDate(dataPosicao)}.` })
  }

  function repetirMesAnterior() {
    if (saldosAnteriores.size === 0) return
    setEdicoes((prev) => {
      const proximo = { ...prev }
      for (const [ativoId, saldo] of saldosAnteriores) {
        const atual = proximo[ativoId] ?? EDICAO_VAZIA
        // So preenche o que ainda esta vazio: nao sobrescreve o que a B3
        // trouxe nem o que ja foi digitado.
        if (paraNumero(atual.saldo) != null) continue
        proximo[ativoId] = { ...atual, saldo: paraTexto(saldo), origem: 'Repetido' }
      }
      return proximo
    })
    setSujo(true)
    setMensagem({ tipo: 'ok', texto: 'Saldos vazios preenchidos com o mes anterior. Confira antes de salvar.' })
  }

  function recalcularMovimentos() {
    if (!fechamento) return

    const totais = totaisDoPeriodo(
      movimentacoes,
      fechamentoAnterior?.data_posicao ?? null,
      fechamento.data_posicao
    )

    setEdicoes((prev) => {
      const proximo = { ...prev }
      for (const a of ativosDaGrade) {
        const t = totais.get(a.id)
        const atual = proximo[a.id] ?? EDICAO_VAZIA
        proximo[a.id] = {
          ...atual,
          aportes: paraTexto(t?.aportes ?? 0),
          resgates: paraTexto(t?.resgates ?? 0),
          proventos: paraTexto(t?.proventos ?? 0),
        }
      }
      return proximo
    })
    setSujo(true)

    setMensagem(
      fechamentoAnterior
        ? {
            tipo: 'ok',
            texto: `Aportes, resgates e proventos recalculados das movimentacoes entre ${formatDate(fechamentoAnterior.data_posicao)} e ${formatDate(fechamento.data_posicao)}.`,
          }
        : {
            tipo: 'ok',
            texto: 'Primeiro fechamento: sem periodo anterior, os movimentos ficam zerados. O rendimento passa a ser apurado a partir do proximo mes.',
          }
    )
  }

  async function salvar() {
    if (!fechamento) return
    setSalvando(true)
    setMensagem(null)

    const paraGravar = linhasGrade
      .filter((l) => l.saldo != null)
      .map((l) => ({
        fechamento_id: fechamento.id,
        ativo_id: l.ativo.id,
        quantidade: paraNumero(l.edicao.quantidade),
        preco_unitario: null,
        saldo: l.saldo as number,
        aportes_mes: paraNumero(l.edicao.aportes) ?? 0,
        resgates_mes: paraNumero(l.edicao.resgates) ?? 0,
        proventos_mes: paraNumero(l.edicao.proventos) ?? 0,
        origem: l.edicao.origem,
      }))

    // Linha que existia e teve o saldo apagado some do fechamento.
    const idsGravados = new Set(paraGravar.map((r) => r.ativo_id))
    const paraApagar = saldos.filter((s) => !idsGravados.has(s.ativo_id)).map((s) => s.id)

    const { error } = await supabase
      .from('saldos_mensais')
      .upsert(paraGravar, { onConflict: 'fechamento_id,ativo_id' })

    if (error) {
      setMensagem({ tipo: 'erro', texto: `Falha ao salvar: ${error.message}` })
      setSalvando(false)
      return
    }

    if (paraApagar.length > 0) {
      const { error: erroDelete } = await supabase.from('saldos_mensais').delete().in('id', paraApagar)
      if (erroDelete) {
        setMensagem({ tipo: 'erro', texto: `Saldos salvos, mas falhou ao remover linhas zeradas: ${erroDelete.message}` })
        setSalvando(false)
        return
      }
    }

    await carregarFechamento()
    setMensagem({ tipo: 'ok', texto: `${paraGravar.length} saldo(s) salvo(s).` })
    setSalvando(false)
  }

  async function alternarStatus() {
    if (!fechamento) return
    const novo = fechado ? 'Aberto' : 'Fechado'

    // Mudar o status recarrega a grade do banco. Sem este aviso, edicao nao
    // salva iria embora sem o usuario perceber.
    if (sujo) {
      setMensagem({ tipo: 'erro', texto: 'Ha alteracoes nao salvas. Salve antes de fechar ou reabrir a competencia.' })
      return
    }

    if (!fechado && pendentes.length > 0) {
      const segue = window.confirm(
        `${pendentes.length} ativo(s) sem saldo neste fechamento. Fechar assim mesmo?`
      )
      if (!segue) return
    }

    const { error } = await supabase.from('fechamentos').update({ status: novo }).eq('id', fechamento.id)
    if (error) {
      setMensagem({ tipo: 'erro', texto: error.message })
      return
    }

    setFechamentos((prev) =>
      prev.map((f) => (f.id === fechamento.id ? { ...f, status: novo as Fechamento['status'] } : f))
    )
    setMensagem({ tipo: 'ok', texto: novo === 'Fechado' ? 'Competencia fechada.' : 'Competencia reaberta.' })
  }

  // ---------- importacao B3 ----------

  async function aoEscolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    if (!arquivo) return

    setLendoArquivo(true)
    setMensagem(null)
    try {
      const resultado = await lerExtratoB3(
        arquivo,
        ativos.map((a) => ({
          id: a.id,
          ticker: a.ticker,
          nome: a.nome,
          corretora_nome: a.bancos_corretoras?.nome ?? null,
        }))
      )
      setImportacao(resultado)
      setLinhasImport(resultado.linhas)
    } catch (erro) {
      setMensagem({ tipo: 'erro', texto: `Nao foi possivel ler o arquivo: ${(erro as Error).message}` })
    } finally {
      setLendoArquivo(false)
      if (inputArquivo.current) inputArquivo.current.value = ''
    }
  }

  function aplicarImportacao() {
    // Duas linhas do extrato podem cair no mesmo cadastro (o mesmo papel em
    // duas abas, por exemplo): somamos antes de escrever na grade.
    const porAtivo = new Map<string, { valor: number; quantidade: number }>()
    for (const l of linhasImport) {
      if (!l.ativoId) continue
      const atual = porAtivo.get(l.ativoId) ?? { valor: 0, quantidade: 0 }
      atual.valor += l.valor
      atual.quantidade += l.quantidade ?? 0
      porAtivo.set(l.ativoId, atual)
    }

    setEdicoes((prev) => {
      const proximo = { ...prev }
      for (const [ativoId, t] of porAtivo) {
        const atual = proximo[ativoId] ?? EDICAO_VAZIA
        proximo[ativoId] = {
          ...atual,
          saldo: paraTexto(t.valor),
          quantidade: t.quantidade ? paraTexto(t.quantidade, 8).replace(/,?0+$/, '') : atual.quantidade,
          origem: 'B3',
        }
      }
      return proximo
    })

    setSujo(true)
    const naoAplicadas = linhasImport.length - porAtivo.size
    setMensagem({
      tipo: 'ok',
      texto: `${porAtivo.size} ativo(s) preenchido(s) pelo extrato${naoAplicadas > 0 ? `; ${naoAplicadas} linha(s) ficaram de fora` : ''}. Revise e clique em Salvar.`,
    })
    setImportacao(null)
    setLinhasImport([])
  }

  function escolherAtivoNaLinha(chave: string, ativoId: string) {
    setLinhasImport((prev) =>
      prev.map((l) =>
        l.chave === chave
          ? { ...l, ativoId: ativoId || null, situacao: ativoId ? 'Casado' : 'SemPar', aviso: null }
          : l
      )
    )
  }

  async function exportar() {
    if (!fechamento) return
    await exportToExcel(
      `saldos_${fechamento.competencia.slice(0, 7)}`,
      rotuloCompetencia(fechamento.competencia),
      [
        { header: 'Ticker', width: 14, value: (l) => l.ativo.ticker },
        { header: 'Nome', width: 30, value: (l) => l.ativo.nome },
        { header: 'Classe', width: 18, value: (l) => l.ativo.classes_ativo?.nome },
        { header: 'Categoria', width: 18, value: (l) => l.ativo.categorias_ativo?.nome },
        { header: 'Corretora', width: 14, value: (l) => l.ativo.bancos_corretoras?.nome },
        { header: 'Quantidade', width: 14, value: (l) => paraNumero(l.edicao.quantidade) },
        { header: 'Saldo Anterior', width: 16, value: (l) => l.anterior },
        { header: 'Saldo', width: 16, value: (l) => l.saldo },
        { header: 'Aportes', width: 14, value: (l) => paraNumero(l.edicao.aportes) },
        { header: 'Resgates', width: 14, value: (l) => paraNumero(l.edicao.resgates) },
        { header: 'Proventos', width: 14, value: (l) => paraNumero(l.edicao.proventos) },
        { header: 'Rendimento', width: 16, value: (l) => l.rendimento },
        { header: 'Rendimento %', width: 14, value: (l) => (l.rentabilidade != null ? Math.round(l.rentabilidade * 10000) / 100 : null) },
        { header: 'Origem', width: 12, value: (l) => (l.saldo == null ? 'Pendente' : l.edicao.origem) },
      ],
      linhasOrdenadas
    )
  }

  const opcoesAtivo = ativos.map((a) => ({
    value: a.id,
    label: `${a.ticker}${a.bancos_corretoras?.nome ? ` (${a.bancos_corretoras.nome})` : ''}`,
  }))

  // ---------- render ----------

  if (loading) {
    return <div className="text-center py-16 text-slate-400">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-56">
            <Select
              label="Competencia"
              options={fechamentos.map((f) => ({
                value: f.id,
                label: `${rotuloCompetencia(f.competencia)} - ${f.status}`,
              }))}
              placeholder={fechamentos.length === 0 ? 'Nenhum fechamento' : undefined}
              value={fechamentoId}
              onChange={(e) => setFechamentoId(e.target.value)}
            />
          </div>

          <Button variant="outline" size="md" onClick={abrirModalNovo}>
            <CalendarPlus className="h-4 w-4" />
            Novo fechamento
          </Button>

          {fechamento && (
            <>
              <div className="flex-1" />

              <input
                ref={inputArquivo}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={aoEscolherArquivo}
              />
              <Button
                variant="outline"
                size="md"
                disabled={fechado}
                loading={lendoArquivo}
                onClick={() => inputArquivo.current?.click()}
              >
                <Upload className="h-4 w-4" />
                Importar extrato B3
              </Button>

              <Button variant="outline" size="md" disabled={fechado || saldosAnteriores.size === 0} onClick={repetirMesAnterior}>
                <Copy className="h-4 w-4" />
                Repetir mes anterior
              </Button>

              <Button variant="outline" size="md" disabled={fechado} onClick={recalcularMovimentos}>
                <Calculator className="h-4 w-4" />
                Recalcular movimentos
              </Button>

              <ExportButton onExport={exportar} disabled={linhasGrade.length === 0} />

              <Button variant="primary" size="md" disabled={fechado || !sujo} loading={salvando} onClick={salvar}>
                <Save className="h-4 w-4" />
                Salvar
              </Button>

              <Button variant={fechado ? 'outline' : 'secondary'} size="md" onClick={alternarStatus}>
                {fechado ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                {fechado ? 'Reabrir' : 'Fechar mes'}
              </Button>
            </>
          )}
        </div>

        {mensagem && (
          <p className={`mt-3 text-sm ${mensagem.tipo === 'ok' ? 'text-green-700' : 'text-red-600'}`}>
            {mensagem.texto}
          </p>
        )}
      </div>

      {!fechamento ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <EmptyState
            icon={<CalendarCheck className="h-12 w-12" />}
            title="Nenhum fechamento mensal ainda"
            description="Crie o fechamento do mes para registrar o saldo dos ativos no primeiro dia util."
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Resumo
              titulo="Posicao de"
              valor={formatDate(fechamento.data_posicao)}
              detalhe={`Competencia ${rotuloCompetencia(fechamento.competencia)}`}
            />
            <Resumo titulo="Saldo total" valor={moeda(totalSaldo)} detalhe={`${preenchidas.length} ativo(s) preenchido(s)`} />
            <Resumo
              titulo="Rendimento do mes"
              valor={fechamentoAnterior ? moeda(totalRendimento) : 'nao apurado'}
              detalhe={fechamentoAnterior ? `vs ${rotuloCompetencia(fechamentoAnterior.competencia)}` : 'primeiro fechamento'}
              cor={fechamentoAnterior && totalRendimento < 0 ? 'text-red-600' : 'text-green-700'}
            />
            <Resumo
              titulo="Cobertura"
              valor={`${preenchidas.length}/${linhasGrade.length}`}
              detalhe={`B3 ${porOrigem('B3')} - Manual ${porOrigem('Manual')} - Repetido ${porOrigem('Repetido')}`}
              cor={pendentes.length > 0 ? 'text-amber-600' : 'text-green-700'}
            />
          </div>

          {pendentes.length > 0 && !fechado && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <div className="flex items-center gap-2 font-medium mb-1">
                <AlertTriangle className="h-4 w-4" />
                {pendentes.length} ativo(s) sem saldo neste fechamento
              </div>
              <p>
                {pendentes.slice(0, 12).map((l) => l.ativo.ticker).join(', ')}
                {pendentes.length > 12 && ` e mais ${pendentes.length - 12}`}
              </p>
            </div>
          )}

          {fechado && (
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-3 text-sm text-slate-600 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Competencia fechada — os saldos estao travados. Clique em Reabrir para editar.
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <Th campo="ticker" ordem={ord.ordem} aoOrdenar={ord.alternar}>Ticker</Th>
                    <Th campo="classe" ordem={ord.ordem} aoOrdenar={ord.alternar}>Classe</Th>
                    <Th campo="categoria" ordem={ord.ordem} aoOrdenar={ord.alternar}>Categoria</Th>
                    <Th campo="corretora" ordem={ord.ordem} aoOrdenar={ord.alternar}>Corretora</Th>
                    <th className="px-3 py-3 font-medium text-slate-600 text-right">Quantidade</th>
                    <Th campo="anterior" ordem={ord.ordem} aoOrdenar={ord.alternar} alinhamento="right">Saldo anterior</Th>
                    <Th campo="saldo" ordem={ord.ordem} aoOrdenar={ord.alternar} alinhamento="right">Saldo</Th>
                    <th className="px-3 py-3 font-medium text-slate-600 text-right">Aportes</th>
                    <th className="px-3 py-3 font-medium text-slate-600 text-right">Resgates</th>
                    <th className="px-3 py-3 font-medium text-slate-600 text-right">Proventos</th>
                    <Th campo="rendimento" ordem={ord.ordem} aoOrdenar={ord.alternar} alinhamento="right">Rendimento</Th>
                    <Th campo="rentabilidade" ordem={ord.ordem} aoOrdenar={ord.alternar} alinhamento="right">Rendimento %</Th>
                    <Th campo="origem" ordem={ord.ordem} aoOrdenar={ord.alternar} alinhamento="center">Origem</Th>
                  </tr>
                </thead>
                <tbody>
                  {linhasOrdenadas.map((l) => (
                    <tr
                      key={l.ativo.id}
                      className={`border-b border-slate-100 ${l.saldo == null ? 'bg-amber-50/40' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">
                        {l.ativo.ticker}
                        {l.ativo.nome && <span className="block text-xs font-normal text-slate-400 truncate max-w-[16rem]">{l.ativo.nome}</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{l.ativo.classes_ativo?.nome}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{l.ativo.categorias_ativo?.nome}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{l.ativo.bancos_corretoras?.nome}</td>
                      <td className="px-2 py-2">
                        <CampoNumero
                          valor={l.edicao.quantidade}
                          desabilitado={fechado}
                          onChange={(v) => alterar(l.ativo.id, 'quantidade', v)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 whitespace-nowrap">
                        {l.anterior != null ? moeda(l.anterior) : '-'}
                      </td>
                      <td className="px-2 py-2">
                        <CampoNumero
                          valor={l.edicao.saldo}
                          desabilitado={fechado}
                          destaque
                          onChange={(v) => alterar(l.ativo.id, 'saldo', v)}
                        />
                      </td>
                      <td className="px-2 py-2">
                        <CampoNumero valor={l.edicao.aportes} desabilitado={fechado} onChange={(v) => alterar(l.ativo.id, 'aportes', v)} />
                      </td>
                      <td className="px-2 py-2">
                        <CampoNumero valor={l.edicao.resgates} desabilitado={fechado} onChange={(v) => alterar(l.ativo.id, 'resgates', v)} />
                      </td>
                      <td className="px-2 py-2">
                        <CampoNumero valor={l.edicao.proventos} desabilitado={fechado} onChange={(v) => alterar(l.ativo.id, 'proventos', v)} />
                      </td>
                      <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                        l.rendimento == null ? 'text-slate-300' : l.rendimento >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {l.rendimento == null ? '-' : moeda(l.rendimento)}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                        l.rentabilidade == null ? 'text-slate-300' : l.rentabilidade >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {l.rentabilidade == null ? '-' : `${(l.rentabilidade * 100).toFixed(2)}%`}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {l.saldo == null ? (
                          <Badge className="bg-amber-100 text-amber-700">Pendente</Badge>
                        ) : (
                          <Badge className={CORES_ORIGEM[l.edicao.origem]}>{l.edicao.origem}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-medium text-slate-900">
                    <td className="px-3 py-3" colSpan={6}>Total</td>
                    <td className="px-3 py-3 text-right">{moeda(totalSaldo)}</td>
                    <td colSpan={3} />
                    <td className={`px-3 py-3 text-right ${totalRendimento >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fechamentoAnterior ? moeda(totalRendimento) : '-'}
                    </td>
                    <td className={`px-3 py-3 text-right ${totalRentabilidade != null && totalRentabilidade >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {totalRentabilidade != null ? `${(totalRentabilidade * 100).toFixed(2)}%` : '-'}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal open={modalNovo} onClose={() => setModalNovo(false)} title="Novo fechamento mensal" size="sm">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="competencia" className="text-sm font-medium text-slate-700">
              Competencia
            </label>
            <input
              id="competencia"
              type="month"
              value={novaCompetencia}
              onChange={(e) => setNovaCompetencia(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {novaCompetencia && (
            <p className="text-sm text-slate-600">
              Data de posicao: <strong>{formatDate(primeiroDiaUtil(`${novaCompetencia}-01`, feriados))}</strong>
              <span className="block text-xs text-slate-400">
                Primeiro dia util do mes, pulando fim de semana e feriado nacional.
              </span>
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalNovo(false)}>Cancelar</Button>
            <Button onClick={criarFechamento} disabled={!novaCompetencia}>Criar</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={importacao !== null}
        onClose={() => { setImportacao(null); setLinhasImport([]) }}
        title="Conferencia do extrato B3"
        size="lg"
      >
        {importacao && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600 space-y-1">
              <p>
                <strong>{linhasImport.length}</strong> linha(s) lida(s) em: {importacao.abasLidas.join(', ') || 'nenhuma aba'}
              </p>
              {importacao.abasIgnoradas.length > 0 && (
                <p className="text-xs text-slate-400">
                  Abas ignoradas: {importacao.abasIgnoradas.map((a) => `${a.aba} (${a.motivo})`).join(', ')}
                </p>
              )}
              <p>
                Casadas: <strong>{linhasImport.filter((l) => l.ativoId).length}</strong> -
                Sem par ou ambiguas: <strong>{linhasImport.filter((l) => !l.ativoId).length}</strong>
              </p>
              <p className="text-xs text-slate-400">
                Nada e gravado agora: aplicar so preenche a grade. As linhas sem par ficam de fora — cadastre o
                ativo ou escolha o cadastro aqui.
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-3 py-2 font-medium text-slate-600">Papel</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Instituicao</th>
                    <th className="px-3 py-2 font-medium text-slate-600 text-right">Valor</th>
                    <th className="px-3 py-2 font-medium text-slate-600">Cadastro</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasImport.map((l) => (
                    <tr key={l.chave} className="border-b border-slate-100">
                      <td className="px-3 py-2">
                        <span className="font-medium text-slate-900">{l.identificador}</span>
                        <span className="block text-xs text-slate-400">{l.aba}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs">{l.instituicao ?? '-'}</td>
                      <td className="px-3 py-2 text-right text-slate-700 whitespace-nowrap">{moeda(l.valor)}</td>
                      <td className="px-3 py-2">
                        {l.situacao === 'Casado' ? (
                          <div className="flex items-center gap-2">
                            <Badge className={CORES_SITUACAO.Casado}>{ROTULO_SITUACAO.Casado}</Badge>
                            <span className="text-xs text-slate-500">
                              {opcoesAtivo.find((o) => o.value === l.ativoId)?.label}
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Badge className={CORES_SITUACAO[l.situacao]}>{ROTULO_SITUACAO[l.situacao]}</Badge>
                            {l.aviso && <span className="block text-xs text-slate-500">{l.aviso}</span>}
                            <Select
                              options={
                                l.candidatos.length > 0
                                  ? opcoesAtivo.filter((o) => l.candidatos.includes(o.value))
                                  : opcoesAtivo
                              }
                              placeholder="Deixar de fora"
                              value={l.ativoId ?? ''}
                              onChange={(e) => escolherAtivoNaLinha(l.chave, e.target.value)}
                              className="text-xs py-1"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setImportacao(null); setLinhasImport([]) }}>
                Cancelar
              </Button>
              <Button onClick={aplicarImportacao} disabled={linhasImport.filter((l) => l.ativoId).length === 0}>
                Aplicar na grade
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Resumo({ titulo, valor, detalhe, cor = 'text-slate-900' }: {
  titulo: string
  valor: string
  detalhe?: string
  cor?: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{titulo}</p>
      <p className={`mt-1 text-lg font-semibold ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-xs text-slate-400">{detalhe}</p>}
    </div>
  )
}

function CampoNumero({ valor, onChange, desabilitado, destaque }: {
  valor: string
  onChange: (v: string) => void
  desabilitado?: boolean
  destaque?: boolean
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={valor}
      disabled={desabilitado}
      onChange={(e) => onChange(e.target.value)}
      className={`w-28 rounded border px-2 py-1 text-sm text-right tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400 ${
        destaque ? 'border-slate-400 font-medium text-slate-900' : 'border-slate-200 text-slate-600'
      }`}
    />
  )
}
