import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { coletarDadosCarteira } from '@/lib/relatorio/coletarDados'
import { buscarBenchmarksBCB, buscarBenchmarksMercadoViaIA } from '@/lib/relatorio/benchmarks'
import { gerarNarrativa } from '@/lib/relatorio/narrativa'
import { renderRelatorioHtml } from '@/lib/relatorio/template'
import type { RelatorioData, RelatorioNarrativa } from '@/lib/relatorio/types'

interface CorpoGerar {
  action: 'gerar'
  fechamentoId: string
  benchmarksModo: 'auto' | 'manual'
  benchmarksManual?: {
    ibovespaVar12m: number | null
    ifixVar12m: number | null
    tesouroIpcaTaxa: number | null
    tesouroPreTaxa: number | null
  }
}

interface CorpoSalvar {
  action: 'salvar'
  fechamentoId: string
  competencia: string
  patrimonioAjustado: number
  html: string
  dados: RelatorioData
  narrativa: RelatorioNarrativa
  benchmarks: unknown
}

type Corpo = CorpoGerar | CorpoSalvar

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' }, { status: 500 })
  }

  let body: Corpo
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corpo da requisição inválido.' }, { status: 400 })
  }

  try {
    if (body.action === 'gerar') return await gerar(supabase, body)
    if (body.action === 'salvar') return await salvar(supabase, user.id, body)
    return Response.json({ error: 'Ação desconhecida.' }, { status: 400 })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'Limite de uso da IA atingido. Tente novamente em instantes.' }, { status: 429 })
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'Chave da API Anthropic inválida.' }, { status: 500 })
    }
    console.error('Erro ao gerar/salvar relatório:', e)
    const mensagem = e instanceof Error ? e.message : 'Falha inesperada.'
    return Response.json({ error: mensagem }, { status: 500 })
  }
}

async function gerar(supabase: Awaited<ReturnType<typeof createClient>>, body: CorpoGerar) {
  if (!body.fechamentoId) {
    return Response.json({ error: 'Selecione um fechamento.' }, { status: 400 })
  }

  const { data: fechamento } = await supabase
    .from('fechamentos')
    .select('id, competencia, status')
    .eq('id', body.fechamentoId)
    .single()

  if (!fechamento) return Response.json({ error: 'Fechamento não encontrado.' }, { status: 404 })
  if (fechamento.status !== 'Fechado') {
    return Response.json({ error: 'Só é possível gerar o relatório de um fechamento com status "Fechado".' }, { status: 400 })
  }

  const bcb = await buscarBenchmarksBCB()

  let mercado: { ibovespaVar12m: number | null; ifixVar12m: number | null; tesouroIpcaTaxa: number | null; tesouroPreTaxa: number | null; fontes: string[] }
  if (body.benchmarksModo === 'auto') {
    mercado = await buscarBenchmarksMercadoViaIA(fechamento.competencia)
  } else {
    mercado = {
      ibovespaVar12m: body.benchmarksManual?.ibovespaVar12m ?? null,
      ifixVar12m: body.benchmarksManual?.ifixVar12m ?? null,
      tesouroIpcaTaxa: body.benchmarksManual?.tesouroIpcaTaxa ?? null,
      tesouroPreTaxa: body.benchmarksManual?.tesouroPreTaxa ?? null,
      fontes: [],
    }
  }

  const dados = await coletarDadosCarteira(supabase, body.fechamentoId, {
    benchmarksModo: body.benchmarksModo,
    benchmarksFontes: mercado.fontes,
    benchmarks: {
      selicMeta: bcb.selicMeta,
      cdi: bcb.cdi,
      ipca12m: bcb.ipca12m,
      tesouroIpcaTaxa: mercado.tesouroIpcaTaxa,
      tesouroPreTaxa: mercado.tesouroPreTaxa,
      ibovespaVar12m: mercado.ibovespaVar12m,
      ifixVar12m: mercado.ifixVar12m,
    },
  })

  const narrativa = await gerarNarrativa(dados)
  const html = renderRelatorioHtml(dados, narrativa, { ocultarValores: false })

  return Response.json({
    html,
    dados,
    narrativa,
    benchmarksFalhasBCB: bcb.falhas,
  })
}

async function salvar(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, body: CorpoSalvar) {
  if (!body.fechamentoId || !body.html || !body.dados || !body.narrativa) {
    return Response.json({ error: 'Dados incompletos para salvar.' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('relatorios_investimentos')
    .upsert(
      {
        fechamento_id: body.fechamentoId,
        competencia: body.competencia,
        patrimonio_ajustado: body.patrimonioAjustado,
        benchmarks: body.benchmarks,
        dados: body.dados,
        narrativa: body.narrativa,
        conteudo_html: body.html,
        gerado_em: new Date().toISOString(),
        created_by: userId,
      },
      { onConflict: 'fechamento_id' }
    )
    .select('id')
    .single()

  if (error) {
    console.error('Erro ao salvar relatório:', error)
    return Response.json({ error: 'Falha ao salvar no histórico: ' + error.message }, { status: 500 })
  }

  return Response.json({ id: data.id })
}
