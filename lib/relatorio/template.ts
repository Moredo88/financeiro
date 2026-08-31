import { formatCurrency, formatDate } from '@/lib/utils'
import { CARTEIRA_ALVO } from './carteiraAlvo'
import type { RelatorioData, RelatorioNarrativa, PosicaoAtivo, AlertaQualidade, Severidade } from './types'

export interface RenderOpcoes {
  /** Quando true, todo valor monetário sai como % do patrimônio ajustado em vez de R$. */
  ocultarValores: boolean
}

// ---------------------------------------------------------------- helpers

function esc(s: string | null | undefined): string {
  if (s == null) return ''
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function pct1(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(casas).replace('.', ',') + '%'
}

function sinalPct(v: number | null | undefined, casas = 1): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = v >= 0 ? '+' : '−'
  return s + Math.abs(v).toFixed(casas).replace('.', ',') + '%'
}

function sinalPP(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const s = v >= 0 ? '+' : '−'
  return s + Math.abs(v).toFixed(2).replace('.', ',') + ' p.p.'
}

function dataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return formatDate(iso)
  } catch {
    return iso
  }
}

const SEVERIDADE_LABEL: Record<Severidade, string> = {
  critica: 'Crítica',
  elevada: 'Elevada',
  moderada: 'Moderada',
  baixa: 'Baixa',
}
const VEREDICTO_LABEL: Record<string, string> = {
  manter: 'Manter',
  avaliar: 'Avaliar',
  reduzir: 'Reduzir',
  nao_avaliavel: 'Não avaliável',
}
const VEREDICTO_CHIP: Record<string, string> = {
  manter: 'g',
  avaliar: 'y',
  reduzir: 'r',
  nao_avaliavel: 'n',
}

const PRIORIDADE_LABEL: Record<string, string> = { alta: 'Alta prioridade', media: 'Média prioridade', baixa: 'Baixa prioridade' }
const PRIORIDADE_CHIP: Record<string, string> = { alta: 'r', media: 'y', baixa: 'n' }
const CONVICCAO_LABEL: Record<string, string> = { alta: 'Convicção alta', media: 'Convicção média', baixa: 'Convicção baixa' }

function chip(classe: string, texto: string): string {
  return `<span class="chip ${classe}">${esc(texto)}</span>`
}

// ------------------------------------------------------------- construtor

export function renderRelatorioHtml(data: RelatorioData, narrativa: RelatorioNarrativa, opcoes: RenderOpcoes): string {
  const total = data.patrimonioAjustado

  function valorCel(v: number | null | undefined): string {
    if (v == null || !Number.isFinite(v)) return '—'
    if (opcoes.ocultarValores) {
      const p = total > 0 ? (v / total) * 100 : 0
      return sinalPct(p, Math.abs(p) < 0.1 && p !== 0 ? 3 : 1)
    }
    return formatCurrency(v)
  }

  const secoes = [
    secaoVisaoExecutiva(data, narrativa, valorCel),
    secaoQualidadeDados(data, valorCel),
    secaoDiagnostico(narrativa),
    secaoAlocacao(data, valorCel),
    secaoDiversificacao(data, narrativa, valorCel),
    secaoRisco(narrativa),
    secaoRendaFixa(data, narrativa, valorCel),
    secaoAcoes(data, narrativa, valorCel),
    secaoFiis(data, narrativa, valorCel),
    secaoInternacional(narrativa),
    secaoEtfs(narrativa),
    secaoPerformance(data, narrativa),
    secaoPontosFortes(narrativa),
    secaoPontosAtencao(narrativa, data),
    secaoListasRendaFixa(data, valorCel),
    secaoOportunidades(narrativa),
    secaoCarteiraAlvo(data, narrativa),
    secaoRebalanceamento(narrativa),
    secaoPlanoAcao(narrativa),
    secaoTop10(narrativa),
    secaoRiscosPremissas(data, narrativa),
    secaoConclusao(narrativa),
  ]

  const indice = [
    '01·Visão executiva', '02·Qualidade dos dados', '03·Diagnóstico', '04·Alocação atual',
    '05·Diversificação', '06·Risco', '07·Renda fixa', '08·Ações', '09·FIIs', '10·Internacional',
    '11·ETFs', '12·Performance', '13·Pontos fortes', '14·Pontos de atenção', '15·Aumentar/Manter/Reduzir',
    '16·Oportunidades', '17·Carteira-alvo', '18·Rebalanceamento', '19·Plano de ação', '20·Top 10',
    '21·Riscos e premissas', '22·Conclusão',
  ]
    .map((t) => {
      const [n, label] = t.split('·')
      return `<li><a href="#s${n}"><i>${n}</i>${esc(label)}</a></li>`
    })
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório de Carteira — ${esc(rotuloCompetencia(data.competencia))}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&family=Libre+Franklin:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="shell">
<header class="masthead">
  <p class="kicker">Relatório executivo de investimentos · Competência ${esc(rotuloCompetencia(data.competencia))}${opcoes.ocultarValores ? ' · Versão em percentuais' : ''}</p>
  <h1>${esc(narrativa.resumoExecutivo.acaoPrioritaria || 'Diagnóstico da carteira')}</h1>
  <div class="byline">
    <span>Data de posição <b>${esc(dataBr(data.dataPosicao))}</b></span>
    <span>Gerado em <b>${esc(dataBr(data.geradoEm))}</b></span>
    <span>Benchmarks <b>${data.limiares.benchmarksModo === 'auto' ? 'IA + web' : 'Manual'}</b></span>
  </div>
</header>

<dl class="ledger">
  <div class="lead"><dt>Patrimônio ajustado</dt><dd>${valorCel(data.patrimonioAjustado)}<small>Base de 100% deste relatório</small></dd></div>
  <div><dt>Registrado no sistema</dt><dd>${valorCel(data.patrimonioRegistrado)}<small>Antes dos ajustes de qualidade de dado</small></dd></div>
  <div><dt>Ativos com saldo</dt><dd>${data.totais.ativosComSaldo}<small>de ${data.totais.ativos} cadastrados</small></dd></div>
  <div><dt>Alertas críticos</dt><dd>${data.alertas.filter((a) => a.severidade === 'critica').length}<small>de ${data.alertas.length} no total</small></dd></div>
</dl>

<div class="layout">
<nav class="rail" aria-label="Índice"><p class="rail-h">Índice</p><ol>${indice}</ol></nav>
<main>
${secoes.join('\n')}
<footer>
  <p>Relatório gerado automaticamente pelo sistema financeiro pessoal, competência ${esc(rotuloCompetencia(data.competencia))}. Toda a aritmética (posições, alocação, limiares de indiferença fiscal, veredito por papel) é calculada em código; a IA escreve apenas a análise textual, a partir desses números.</p>
  <p>Documento analítico de uso pessoal. Não constitui recomendação personalizada de investimento, oferta de valores mobiliários ou promessa de rentabilidade.</p>
</footer>
</main>
</div>
</div>
</body>
</html>`
}

function rotuloCompetencia(iso: string): string {
  const [ano, mes] = iso.split('-')
  const nomes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  return `${nomes[Number(mes) - 1] ?? mes}/${ano}`
}

// --------------------------------------------------------------- seções

function secaoVisaoExecutiva(data: RelatorioData, n: RelatorioNarrativa, valorCel: (v: number) => string): string {
  const linhas = data.alocacaoPorClasse
    .map(
      (c) =>
        `<tr><td>${esc(c.classe)}</td><td class="r num">${valorCel(c.valor)}</td><td class="r num">${pct1(c.percentual)}</td></tr>`
    )
    .join('')

  return `<section id="s01"><div class="sec-head"><span class="sec-num">01</span><h2>Visão executiva</h2></div>
  <div class="prose"><p>${esc(n.resumoExecutivo.diagnostico)}</p></div>
  <div class="tw"><table><thead><tr><th>Classe</th><th class="r">Valor</th><th class="r">%</th></tr></thead><tbody>${linhas}</tbody>
  <tfoot><tr><td>Total</td><td class="r num">${valorCel(data.patrimonioAjustado)}</td><td class="r num">100,0%</td></tr></tfoot></table></div>
  <div class="split">
    <div class="panel"><p class="pt">Principal ponto positivo</p><p>${esc(n.resumoExecutivo.pontoPositivo)}</p></div>
    <div class="panel"><p class="pt">Principal risco</p><p>${esc(n.resumoExecutivo.principalRisco)}</p></div>
    <div class="panel"><p class="pt">Principal oportunidade</p><p>${esc(n.resumoExecutivo.principalOportunidade)}</p></div>
    <div class="panel"><p class="pt">Ação prioritária</p><p>${esc(n.resumoExecutivo.acaoPrioritaria)}</p></div>
  </div>
  </section>`
}

function secaoQualidadeDados(data: RelatorioData, valorCel: (v: number) => string): string {
  const criticos = data.alertas.filter((a) => a.severidade === 'critica')
  const resto = data.alertas.filter((a) => a.severidade !== 'critica')

  function linhaAlerta(a: AlertaQualidade): string {
    return `<div class="callout ${a.severidade === 'critica' ? 'crit' : a.severidade === 'elevada' ? 'warn' : ''}">
      <span class="ct">${SEVERIDADE_LABEL[a.severidade]}${a.valorEnvolvido != null ? ' · ' + valorCel(a.valorEnvolvido) : ''}</span>
      <p><strong>${esc(a.titulo)}</strong></p><p>${esc(a.descricao)}</p>
    </div>`
  }

  return `<section id="s02"><div class="sec-head"><span class="sec-num">02</span><h2>Resumo da carteira e qualidade dos dados</h2></div>
  <div class="prose"><p>Base: ${data.totais.ativos} ativos cadastrados, ${data.totais.ativosComSaldo} com saldo de mercado, ${data.totais.movimentacoes} movimentações. Patrimônio registrado ${valorCel(data.patrimonioRegistrado)}; patrimônio ajustado (usado no resto deste relatório) ${valorCel(data.patrimonioAjustado)}.</p></div>
  ${criticos.length ? criticos.map(linhaAlerta).join('') : '<div class="callout good"><span class="ct">Sem bloqueios</span><p>Nenhum alerta crítico neste mês.</p></div>'}
  ${resto.length ? `<h3>Demais observações de qualidade de dado</h3>${resto.map(linhaAlerta).join('')}` : ''}
  </section>`
}

function secaoDiagnostico(n: RelatorioNarrativa): string {
  return `<section id="s03"><div class="sec-head"><span class="sec-num">03</span><h2>Diagnóstico geral</h2></div>
  <div class="prose"><p>${esc(n.diagnosticoGeral).replace(/\n\n/g, '</p><p>')}</p></div>
  </section>`
}

function secaoAlocacao(data: RelatorioData, valorCel: (v: number) => string): string {
  const linhas = data.alocacaoPorClasse
    .map((c) => {
      const alvo = CARTEIRA_ALVO[c.classe] ?? 0
      const delta = c.percentual - alvo
      return `<tr><td>${esc(c.classe)}</td><td class="r num">${valorCel(c.valor)}</td><td class="r num">${pct1(c.percentual)}</td><td class="r num">${pct1(alvo)}</td><td class="r num">${sinalPct(delta)}</td></tr>`
    })
    .join('')

  return `<section id="s04"><div class="sec-head"><span class="sec-num">04</span><h2>Alocação atual contra a carteira-alvo</h2></div>
  <div class="tw"><table><thead><tr><th>Classe</th><th class="r">Valor</th><th class="r">% atual</th><th class="r">% alvo</th><th class="r">Δ p.p.</th></tr></thead><tbody>${linhas}</tbody></table></div>
  <p class="tnote">Alvo definido pelo perfil confirmado do usuário (moderado, 10+ anos, sem resgate, concentração intencional em real) — ver <span class="mono">lib/relatorio/carteiraAlvo.ts</span>.</p>
  </section>`
}

function secaoDiversificacao(data: RelatorioData, n: RelatorioNarrativa, valorCel: (v: number) => string): string {
  const c = data.concentracao
  const corretora = c.porCorretora
    .map((x) => `<tr><td>${esc(x.nome)}</td><td class="r num">${valorCel(x.valor)}</td><td class="r num">${pct1(x.percentual)}</td></tr>`)
    .join('')
  const setor = c.porSetor
    .map((x) => `<tr><td>${esc(x.nome)}</td><td class="r num">${valorCel(x.valor)}</td><td class="r num">${pct1(x.percentual)}</td></tr>`)
    .join('')

  return `<section id="s05"><div class="sec-head"><span class="sec-num">05</span><h2>Análise de diversificação</h2></div>
  <div class="prose"><p>${esc(n.analiseDiversificacao)}</p></div>
  <div class="tw"><table><thead><tr><th>Concentração</th><th class="r">%</th></tr></thead><tbody>
    <tr><td>Maior posição individual</td><td class="r num">${pct1(c.maiorPosicaoPct)}</td></tr>
    <tr><td>Top 5 posições</td><td class="r num">${pct1(c.top5Pct)}</td></tr>
    <tr><td>Top 10 posições</td><td class="r num">${pct1(c.top10Pct)}</td></tr>
  </tbody></table></div>
  <h3>Por corretora</h3>
  <div class="tw"><table><thead><tr><th>Corretora</th><th class="r">Valor</th><th class="r">%</th></tr></thead><tbody>${corretora}</tbody></table></div>
  <h3>Por setor (renda variável)</h3>
  <div class="tw"><table><thead><tr><th>Setor</th><th class="r">Valor</th><th class="r">%</th></tr></thead><tbody>${setor}</tbody></table></div>
  </section>`
}

function secaoRisco(n: RelatorioNarrativa): string {
  return `<section id="s06"><div class="sec-head"><span class="sec-num">06</span><h2>Análise de risco</h2></div>
  <div class="prose"><p>${esc(n.analiseRisco)}</p></div>
  </section>`
}

function secaoRendaFixa(data: RelatorioData, n: RelatorioNarrativa, valorCel: (v: number) => string): string {
  const rf = data.posicoes.filter((p) => p.ehRendaFixa && p.valorMercado > 0).sort((a, b) => b.valorMercado - a.valorMercado)
  const linhas = rf
    .map((p) => {
      const v = p.rendaFixaVeredito
      return `<tr class="sv sv-${v ? VEREDICTO_STRIPE[v.veredicto] : 'n'}">
        <td class="tk">${esc(p.ticker)}</td><td>${esc(p.categoria)}</td><td>${esc(p.indexador)} ${p.taxa != null ? esc(String(p.taxa)) + '%' : ''}</td>
        <td class="mono">${p.vencimento ? esc(dataBr(p.vencimento)) : '—'}</td><td class="r num">${valorCel(p.valorMercado)}</td>
        <td class="r num">${v ? sinalPP(v.premioPontosPercentuais) : '—'}</td>
        <td>${v ? chip(VEREDICTO_CHIP[v.veredicto], VEREDICTO_LABEL[v.veredicto]) : '—'}</td>
      </tr>`
    })
    .join('')

  const l = data.limiares
  return `<section id="s07"><div class="sec-head"><span class="sec-num">07</span><h2>Análise de renda fixa</h2></div>
  <div class="callout"><span class="ct">Limiares de indiferença fiscal deste mês</span>
    <ul class="tight">
      <li><strong>${l.limiarIpcaIsento != null ? 'IPCA+' + pct1(l.limiarIpcaIsento, 2) : 'indisponível'}</strong> — isento equivalente ao Tesouro IPCA+ líquido.</li>
      <li><strong>${l.limiarPreIsento != null ? pct1(l.limiarPreIsento, 2) + ' a.a.' : 'indisponível'}</strong> — isento equivalente ao Tesouro Prefixado líquido.</li>
      <li><strong>${l.tesouroSelicLiquido != null ? pct1(l.tesouroSelicLiquido, 2) + ' a.a. líquido' : 'indisponível'}</strong> — retorno do Tesouro Selic líquido de IR e custódia; base de comparação dos pós-fixados em CDI.</li>
    </ul>
  </div>
  <div class="prose"><p>${esc(n.analiseRendaFixa)}</p></div>
  <div class="tw"><table><thead><tr><th>Papel</th><th>Categoria</th><th>Remuneração</th><th>Venc.</th><th class="r">Valor</th><th class="r">Prêmio</th><th>Veredito</th></tr></thead>
  <tbody>${linhas}</tbody>
  <tfoot><tr><td colspan="4">Total renda fixa</td><td class="r num">${valorCel(rf.reduce((s, p) => s + p.valorMercado, 0))}</td><td colspan="2"></td></tr></tfoot></table></div>
  <p class="tnote">Prêmio em pontos percentuais de retorno ao ano, nunca em pontos de %CDI — ver <span class="mono">lib/relatorio/limiares.ts</span>.</p>
  </section>`
}

const VEREDICTO_STRIPE: Record<string, string> = { manter: 'good', avaliar: 'warn', reduzir: 'crit', nao_avaliavel: '' }

function secaoAcoes(data: RelatorioData, n: RelatorioNarrativa, valorCel: (v: number) => string): string {
  const acoes = data.posicoes
    .filter((p) => !p.ehRendaFixa && p.categoria !== 'FII' && p.valorMercado > 0)
    .sort((a, b) => b.valorMercado - a.valorMercado)
  const linhas = acoes
    .map(
      (p) =>
        `<tr><td class="tk">${esc(p.ticker)}</td><td>${esc(p.categoria)}</td><td>${esc(p.setor ?? 'Não mapeado')}</td><td class="r num">${valorCel(p.valorMercado)}</td><td class="r num">${pct1(total(data) > 0 ? (p.valorMercado / total(data)) * 100 : 0)}</td></tr>`
    )
    .join('')

  return `<section id="s08"><div class="sec-head"><span class="sec-num">08</span><h2>Análise de ações e ETFs</h2></div>
  <div class="prose"><p>${esc(n.analiseAcoes)}</p></div>
  <div class="tw"><table><thead><tr><th>Ativo</th><th>Categoria</th><th>Setor</th><th class="r">Valor</th><th class="r">% do PL</th></tr></thead><tbody>${linhas}</tbody></table></div>
  </section>`
}

function total(data: RelatorioData): number {
  return data.patrimonioAjustado
}

function secaoFiis(data: RelatorioData, n: RelatorioNarrativa, valorCel: (v: number) => string): string {
  const fiis = data.posicoes.filter((p) => p.categoria === 'FII' && p.valorMercado > 0).sort((a, b) => b.valorMercado - a.valorMercado)
  const linhas = fiis
    .map(
      (p) =>
        `<tr><td class="tk">${esc(p.ticker)}</td><td>${esc(p.classe)}</td><td class="r num">${valorCel(p.valorMercado)}</td></tr>`
    )
    .join('')

  return `<section id="s09"><div class="sec-head"><span class="sec-num">09</span><h2>Análise de FIIs</h2></div>
  <div class="prose"><p>${esc(n.analiseFiis)}</p></div>
  ${fiis.length ? `<div class="tw"><table><thead><tr><th>Fundo</th><th>Classe cadastrada</th><th class="r">Valor</th></tr></thead><tbody>${linhas}</tbody></table></div>` : '<p class="tnote">Nenhum FII com saldo neste mês.</p>'}
  </section>`
}

function secaoInternacional(n: RelatorioNarrativa): string {
  return `<section id="s10"><div class="sec-head"><span class="sec-num">10</span><h2>Análise internacional</h2></div>
  <div class="prose"><p>${esc(n.analiseInternacional)}</p></div>
  </section>`
}

function secaoEtfs(n: RelatorioNarrativa): string {
  return `<section id="s11"><div class="sec-head"><span class="sec-num">11</span><h2>Análise de ETFs</h2></div>
  <div class="prose"><p>${esc(n.analiseEtfs)}</p></div>
  </section>`
}

function secaoPerformance(data: RelatorioData, n: RelatorioNarrativa): string {
  const l = data.limiares
  const linha = (nome: string, v: number | null, sufixo = '% a.a.') =>
    `<tr><td>${nome}</td><td class="r num">${v != null ? pct1(v, 2) + (sufixo ? ' ' + sufixo.replace('% a.a.', 'a.a.') : '') : 'indisponível'}</td></tr>`

  return `<section id="s12"><div class="sec-head"><span class="sec-num">12</span><h2>Performance e benchmarks</h2></div>
  <div class="prose"><p>${esc(n.performanceBenchmarks)}</p></div>
  <div class="tw"><table><thead><tr><th>Indicador</th><th class="r">Nível</th></tr></thead><tbody>
    ${linha('Selic meta', l.selicMeta)}
    ${linha('CDI', l.cdi)}
    ${linha('IPCA 12 meses', l.ipca12m)}
    ${linha('Ibovespa (var. 12m)', l.ibovespaVar12m)}
    ${linha('IFIX (var. 12m)', l.ifixVar12m)}
    ${linha('Tesouro IPCA+ (taxa)', l.tesouroIpcaTaxa)}
    ${linha('Tesouro Prefixado (taxa)', l.tesouroPreTaxa)}
  </tbody></table></div>
  <p class="tnote">Fonte: Selic/CDI/IPCA via Banco Central (SGS). Ibovespa/IFIX/Tesouro: ${l.benchmarksModo === 'auto' ? 'pesquisados pela IA — ' + esc(l.benchmarksFontes.join(', ') || 'fontes não registradas') : 'informados manualmente'}.</p>
  </section>`
}

function secaoPontosFortes(n: RelatorioNarrativa): string {
  return `<section id="s13"><div class="sec-head"><span class="sec-num">13</span><h2>Pontos fortes</h2></div>
  <ul class="tight">${n.pontosFortes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </section>`
}

function secaoPontosAtencao(n: RelatorioNarrativa, data: RelatorioData): string {
  return `<section id="s14"><div class="sec-head"><span class="sec-num">14</span><h2>⚠️ Pontos de atenção</h2></div>
  <ul class="tight">${n.pontosAtencao.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  ${data.alertas.length ? `<p class="tnote">Detalhe de cada alerta na seção 02.</p>` : ''}
  </section>`
}

function secaoListasRendaFixa(data: RelatorioData, valorCel: (v: number) => string): string {
  const rf = data.posicoes.filter((p) => p.ehRendaFixa && p.valorMercado > 0 && p.rendaFixaVeredito)
  const grupos: Record<string, PosicaoAtivo[]> = { manter: [], avaliar: [], reduzir: [] }
  for (const p of rf) {
    const v = p.rendaFixaVeredito!.veredicto
    if (v === 'manter' || v === 'avaliar' || v === 'reduzir') grupos[v].push(p)
  }
  const lista = (titulo: string, chipClasse: string, itens: PosicaoAtivo[]) =>
    itens.length
      ? `<h3>${titulo}</h3><div class="tw"><table><thead><tr><th>Papel</th><th class="r">Valor</th><th class="r">Prêmio</th></tr></thead><tbody>${itens
          .sort((a, b) => b.valorMercado - a.valorMercado)
          .map(
            (p) =>
              `<tr><td class="tk">${esc(p.ticker)}</td><td class="r num">${valorCel(p.valorMercado)}</td><td class="r num">${sinalPP(p.rendaFixaVeredito!.premioPontosPercentuais)}</td></tr>`
          )
          .join('')}</tbody></table></div>`
      : ''

  return `<section id="s15"><div class="sec-head"><span class="sec-num">15</span><h2>Renda fixa: manter, avaliar e reduzir</h2></div>
  <div class="prose"><p>Classificação automática por prêmio sobre o Tesouro equivalente (ver seção 07). "Avaliar" não é uma recomendação de venda — é onde o prêmio ficou pequeno demais para o prazo, e vale conferir a cotação de saída antes de decidir.</p></div>
  ${lista('🟢 Manter', 'g', grupos.manter)}
  ${lista('🟡 Avaliar', 'y', grupos.avaliar)}
  ${lista('🔴 Reduzir', 'r', grupos.reduzir)}
  </section>`
}

function secaoOportunidades(n: RelatorioNarrativa): string {
  return `<section id="s16"><div class="sec-head"><span class="sec-num">16</span><h2>Oportunidades</h2></div>
  <ul class="tight">${n.oportunidades.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
  </section>`
}

function secaoCarteiraAlvo(data: RelatorioData, n: RelatorioNarrativa): string {
  const linhas = data.alocacaoPorClasse
    .map((c) => {
      const alvo = CARTEIRA_ALVO[c.classe] ?? 0
      return `<tr><td>${esc(c.classe)}</td><td class="r num">${pct1(c.percentual)}</td><td class="r num">${pct1(alvo)}</td></tr>`
    })
    .join('')
  return `<section id="s17"><div class="sec-head"><span class="sec-num">17</span><h2>Carteira-alvo recomendada</h2></div>
  <div class="tw"><table><thead><tr><th>Classe</th><th class="r">Atual</th><th class="r">Alvo</th></tr></thead><tbody>${linhas}</tbody></table></div>
  <div class="prose"><p>${esc(n.carteiraAlvoComentario)}</p></div>
  </section>`
}

function secaoRebalanceamento(n: RelatorioNarrativa): string {
  return `<section id="s18"><div class="sec-head"><span class="sec-num">18</span><h2>Plano de rebalanceamento</h2></div>
  <div class="prose"><p>${esc(n.planoRebalanceamento)}</p></div>
  </section>`
}

function secaoPlanoAcao(n: RelatorioNarrativa): string {
  const bloco = (titulo: string, itens: { prioridade: string; texto: string }[]) =>
    `<h3>${titulo}</h3><ul class="acts">${itens
      .map((i) => `<li><div><p>${chip(PRIORIDADE_CHIP[i.prioridade] ?? 'n', PRIORIDADE_LABEL[i.prioridade] ?? i.prioridade)}</p><p>${esc(i.texto)}</p></div></li>`)
      .join('')}</ul>`

  return `<section id="s19"><div class="sec-head"><span class="sec-num">19</span><h2>Plano de ação — 30, 90 e 180 dias</h2></div>
  ${bloco('Próximos 30 dias', n.planoAcao.dias30)}
  ${bloco('Próximos 90 dias', n.planoAcao.dias90)}
  ${bloco('Próximos 180 dias', n.planoAcao.dias180)}
  </section>`
}

function secaoTop10(n: RelatorioNarrativa): string {
  return `<section id="s20"><div class="sec-head"><span class="sec-num">20</span><h2>Top 10 recomendações</h2></div>
  <ol class="acts">${n.top10
    .map(
      (t, i) =>
        `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><div><h4>${esc(t.acao)}</h4>
        <dl><dt>Motivo</dt><dd>${esc(t.motivo)}</dd><dt>Impacto</dt><dd>${esc(t.impactoEsperado)}</dd><dt>Risco</dt><dd>${esc(t.risco)}</dd><dt>Prazo</dt><dd>${esc(t.prazo)}</dd><dt>Convicção</dt><dd>${esc(CONVICCAO_LABEL[t.conviccao] ?? t.conviccao)}</dd></dl>
        </div></li>`
    )
    .join('')}</ol>
  </section>`
}

function secaoRiscosPremissas(data: RelatorioData, n: RelatorioNarrativa): string {
  const l = data.limiares
  return `<section id="s21"><div class="sec-head"><span class="sec-num">21</span><h2>Riscos e premissas</h2></div>
  <ul class="tight">
    <li>Alíquota de IR assumida: ${pct1(l.aliquotaIrPremissa * 100)} (prazo &gt; 720 dias). Custódia B3: ${pct1(l.custodiaB3Premissa * 100)} a.a.</li>
    <li>Benchmarks de mercado: ${l.benchmarksModo === 'auto' ? 'pesquisados pela IA em ' + esc(dataBr(l.benchmarksGeradoEm)) : 'informados manualmente na geração deste relatório'}.</li>
    ${n.riscosPremissas.map((p) => `<li>${esc(p)}</li>`).join('')}
  </ul>
  </section>`
}

function secaoConclusao(n: RelatorioNarrativa): string {
  return `<section id="s22"><div class="sec-head"><span class="sec-num">22</span><h2>Conclusão executiva</h2></div>
  <div class="prose"><p class="big-verdict">${esc(n.conclusaoExecutiva)}</p></div>
  </section>`
}

// ------------------------------------------------------------------ CSS

const CSS = `
:root{--paper:#F6F7F4;--surface:#FCFCFB;--surface-2:#EFF1EC;--surface-3:#E6E9E2;--ink:#141A17;--ink-2:#3D4741;--muted:#6B746E;--rule:#DCDFD8;--rule-strong:#B6BCB3;--accent:#00756D;--accent-soft:#E0EFEC;--good:#2C7A4B;--good-bg:#E6F1EA;--good-line:#2C7A4B;--warn:#946705;--warn-bg:#F6EEDA;--warn-line:#B98A12;--crit:#A6382F;--crit-bg:#F7E8E6;--crit-line:#A6382F}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#121614;--surface:#181D1A;--surface-2:#1E2420;--surface-3:#262D28;--ink:#E9ECE7;--ink-2:#C1C8C0;--muted:#8D958E;--rule:#2B322D;--rule-strong:#414A44;--accent:#45C4B7;--accent-soft:#12302C;--good:#63C288;--good-bg:#152A1E;--good-line:#3E9E63;--warn:#DCAC42;--warn-bg:#2A2414;--warn-line:#B98A12;--crit:#E37A70;--crit-bg:#2D1C1A;--crit-line:#B9564B}}
:root[data-theme="dark"]{--paper:#121614;--surface:#181D1A;--surface-2:#1E2420;--surface-3:#262D28;--ink:#E9ECE7;--ink-2:#C1C8C0;--muted:#8D958E;--rule:#2B322D;--rule-strong:#414A44;--accent:#45C4B7;--accent-soft:#12302C;--good:#63C288;--good-bg:#152A1E;--good-line:#3E9E63;--warn:#DCAC42;--warn-bg:#2A2414;--warn-line:#B98A12;--crit:#E37A70;--crit-bg:#2D1C1A;--crit-line:#B9564B}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Libre Franklin",-apple-system,sans-serif;font-size:16px;line-height:1.6}
.shell{max-width:1180px;margin:0 auto;padding:0 24px 80px}
.prose{max-width:70ch}
p{margin:0 0 1em}
a{color:var(--accent)}
strong{font-weight:600;color:var(--ink)}
.mono{font-family:"IBM Plex Mono",monospace}
.num{font-variant-numeric:tabular-nums}
.masthead{padding:48px 0 0;border-bottom:1px solid var(--rule-strong)}
.kicker{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin:0 0 16px}
h1{font-family:"Newsreader",Georgia,serif;font-weight:400;font-size:clamp(2rem,5vw,3rem);line-height:1.08;margin:0 0 20px}
.byline{display:flex;flex-wrap:wrap;gap:10px 24px;padding:0 0 18px;font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--muted);text-transform:uppercase}
.byline b{color:var(--ink-2)}
.ledger{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));border-bottom:1px solid var(--rule-strong);margin:0 0 8px}
.ledger>div{padding:20px 18px;border-left:1px solid var(--rule)}
.ledger>div:first-child{border-left:0;padding-left:0}
.ledger dt{font-family:"IBM Plex Mono",monospace;font-size:10.5px;text-transform:uppercase;color:var(--muted);margin:0 0 8px}
.ledger dd{margin:0;font-family:"Newsreader",serif;font-size:1.7rem}
.ledger dd small{display:block;font-family:"Libre Franklin",sans-serif;font-size:11px;color:var(--muted);margin-top:6px}
.ledger .lead dd{color:var(--accent)}
.layout{display:grid;grid-template-columns:1fr;gap:0}
@media(min-width:1000px){.layout{grid-template-columns:180px 1fr;gap:48px}.rail{position:sticky;top:20px;padding-top:40px}}
.rail{font-family:"IBM Plex Mono",monospace;font-size:11px}
.rail ol{list-style:none;margin:0;padding:0}
.rail a{display:flex;gap:8px;padding:3px 0;color:var(--muted);text-decoration:none}
.rail a i{color:var(--rule-strong);min-width:16px;font-style:normal}
.rail-h{color:var(--ink);text-transform:uppercase;letter-spacing:.12em;font-size:10px;padding:0 0 8px;margin:36px 0 8px;border-bottom:1px solid var(--rule)}
@media(max-width:999px){.rail{display:none}}
section{padding:40px 0 4px;scroll-margin-top:16px}
section+section{border-top:1px solid var(--rule)}
.sec-head{display:flex;align-items:baseline;gap:12px;margin:0 0 20px}
.sec-num{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--accent);padding-top:.4em}
h2{font-family:"Newsreader",serif;font-weight:400;font-size:clamp(1.4rem,3vw,1.9rem);margin:0}
h3{font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;margin:28px 0 12px;padding-bottom:6px;border-bottom:1px solid var(--rule)}
.callout{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--accent);padding:16px 18px;margin:18px 0}
.callout.crit{border-left-color:var(--crit-line);background:var(--crit-bg)}
.callout.warn{border-left-color:var(--warn-line);background:var(--warn-bg)}
.callout.good{border-left-color:var(--good-line);background:var(--good-bg)}
.callout .ct{font-family:"IBM Plex Mono",monospace;font-size:10.5px;text-transform:uppercase;color:var(--muted);display:block;margin:0 0 8px}
.callout.crit .ct{color:var(--crit)}.callout.warn .ct{color:var(--warn)}.callout.good .ct{color:var(--good)}
.tw{overflow-x:auto;margin:18px 0;border-top:1px solid var(--rule-strong);border-bottom:1px solid var(--rule-strong)}
table{border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px}
thead th{font-family:"IBM Plex Mono",monospace;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left;padding:10px 10px 9px;border-bottom:1px solid var(--rule-strong);white-space:nowrap}
tbody td{padding:8px 10px;border-bottom:1px solid var(--rule)}
tbody tr:last-child td{border-bottom:0}
th.r,td.r{text-align:right}
td.tk{font-family:"IBM Plex Mono",monospace;font-size:12.5px;font-weight:500;white-space:nowrap}
tfoot td{padding:9px 10px;border-top:1px solid var(--rule-strong);font-weight:600}
.tnote{font-size:12px;color:var(--muted);margin:8px 0 0}
tr.sv td:first-child{border-left:3px solid transparent;padding-left:8px}
tr.sv-good td:first-child{border-left-color:var(--good-line)}
tr.sv-warn td:first-child{border-left-color:var(--warn-line)}
tr.sv-crit td:first-child{border-left-color:var(--crit-line)}
.chip{display:inline-flex;align-items:center;gap:5px;font-family:"IBM Plex Mono",monospace;font-size:10px;text-transform:uppercase;padding:2px 7px;border:1px solid;white-space:nowrap}
.chip::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor}
.chip.g{color:var(--good);border-color:var(--good-line);background:var(--good-bg)}
.chip.y{color:var(--warn);border-color:var(--warn-line);background:var(--warn-bg)}
.chip.r{color:var(--crit);border-color:var(--crit-line);background:var(--crit-bg)}
.chip.n{color:var(--muted);border-color:var(--rule-strong);background:var(--surface-2)}
ul.tight{margin:12px 0;padding-left:20px}
ul.tight li{margin:0 0 7px}
.split{display:grid;gap:20px;grid-template-columns:1fr}
@media(min-width:760px){.split{grid-template-columns:1fr 1fr}}
.panel{background:var(--surface);border:1px solid var(--rule);padding:16px 18px}
.pt{font-family:"IBM Plex Mono",monospace;font-size:10.5px;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.acts{list-style:none;margin:16px 0;padding:0;display:grid;gap:0}
.acts li{display:grid;grid-template-columns:30px 1fr;gap:12px;padding:14px 0;border-bottom:1px solid var(--rule)}
.acts li:first-child{border-top:1px solid var(--rule-strong)}
.acts .n{font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--accent)}
.acts h4{margin:0 0 6px}
.acts dl{margin:6px 0 0;display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:13px}
.acts dt{font-family:"IBM Plex Mono",monospace;font-size:10px;text-transform:uppercase;color:var(--muted)}
.acts dd{margin:0;color:var(--ink-2)}
.big-verdict{font-family:"Newsreader",serif;font-size:1.4rem;line-height:1.4}
footer{border-top:1px solid var(--rule-strong);margin-top:48px;padding:24px 0 0;font-size:12px;color:var(--muted)}
@media print{
  @page{size:A4;margin:14mm 12mm 16mm}
  :root,:root[data-theme="dark"],:root:not([data-theme="light"]){--paper:#fff;--surface:#FBFBF9;--ink:#141A17;--ink-2:#3D4741;--muted:#5E6862;--rule:#D3D7CE;--rule-strong:#9AA197;--accent:#00655E}
  .rail{display:none!important}
  .layout{display:block}
  .tw{overflow:visible}
  table{font-size:10.5px}
  tr,.callout,.panel,.acts li{break-inside:avoid}
  h2,h3,.sec-head{break-after:avoid}
}
`
