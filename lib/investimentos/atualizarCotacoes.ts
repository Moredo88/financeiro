import { createAdminClient } from '@/lib/supabase/admin'

const BRAPI_URL = 'https://brapi.dev/api/v2/stocks/quote'
const CLASSES_COTADAS = ['RENDA VAR']

// Quantos tickers cabem numa requisicao da brapi: 1 no plano gratuito,
// 10 no Startup, 20 no Pro. Se um dia mudar de plano, basta ajustar a
// variavel de ambiente no Coolify — nao precisa de deploy.
const TICKERS_POR_REQUISICAO = (() => {
  const n = Number(process.env.BRAPI_TICKERS_POR_REQUISICAO)
  return Number.isInteger(n) && n > 0 ? n : 1
})()

interface BrapiResult {
  symbol?: string
  data?: { symbol?: string; regularMarketPrice?: number; close?: number }
  regularMarketPrice?: number
  close?: number
}

function extractSymbol(entry: BrapiResult): string | null {
  return entry.symbol ?? entry.data?.symbol ?? null
}

function extractPrice(entry: BrapiResult): number | null {
  const raw = entry.data?.regularMarketPrice ?? entry.data?.close ?? entry.regularMarketPrice ?? entry.close
  return typeof raw === 'number' ? raw : null
}

export async function atualizarCotacoes(): Promise<{ ok: boolean; atualizados: number; error?: string }> {
  const token = process.env.BRAPI_TOKEN
  if (!token) {
    return { ok: false, atualizados: 0, error: 'BRAPI_TOKEN nao configurado' }
  }

  const supabase = createAdminClient()

  const { data: classes } = await supabase
    .from('classes_ativo')
    .select('id, nome')
    .in('nome', CLASSES_COTADAS)

  const classeIds = (classes ?? []).map((c) => c.id)
  if (classeIds.length === 0) return { ok: true, atualizados: 0 }

  const { data: ativos } = await supabase
    .from('ativos')
    .select('id, ticker')
    .in('classe_id', classeIds)
    .eq('status', 'Ativo')

  if (!ativos || ativos.length === 0) return { ok: true, atualizados: 0 }

  const agora = new Date().toISOString()
  let atualizados = 0
  const falhas: string[] = []

  // Um lote por requisicao: nenhum plano da brapi aceita a carteira inteira
  // de uma vez. Um lote que falha nao derruba os outros.
  for (let i = 0; i < ativos.length; i += TICKERS_POR_REQUISICAO) {
    const lote = ativos.slice(i, i + TICKERS_POR_REQUISICAO)
    const tickers = lote.map((a) => a.ticker).join(',')

    const res = await fetch(`${BRAPI_URL}?symbols=${encodeURIComponent(tickers)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      falhas.push(`${tickers} (HTTP ${res.status})`)
      continue
    }

    const json: { results?: BrapiResult[] } = await res.json()

    for (const entry of json.results ?? []) {
      const symbol = extractSymbol(entry)
      const preco = extractPrice(entry)
      if (!symbol || preco == null) continue

      const ativo = lote.find((a) => a.ticker === symbol)
      if (!ativo) continue

      await supabase
        .from('ativos')
        .update({ cotacao_atual: preco, cotacao_atualizada_em: agora })
        .eq('id', ativo.id)
      atualizados++
    }
  }

  if (falhas.length > 0) {
    return {
      ok: false,
      atualizados,
      error: `${atualizados} cotacao(oes) atualizada(s); falhou em ${falhas.length}: ${falhas.slice(0, 3).join(', ')}`,
    }
  }

  return { ok: true, atualizados }
}
