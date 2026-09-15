import { formatCurrency, formatDate } from '@/lib/utils'
import { CARTEIRA_ALVO } from './carteiraAlvo'
import type {
  RelatorioData,
  RelatorioNarrativa,
  PosicaoAtivo,
  AlertaQualidade,
  FatiaCarteira,
  Severidade,
} from './types'

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

function anosBr(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toFixed(1).replace('.', ',') + (Math.abs(v) >= 2 ? ' anos' : ' ano')
}

function dataBr(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return formatDate(iso)
  } catch {
    return iso
  }
}

/** Barra proporcional dentro de uma célula de tabela. */
function barra(pct: number | null | undefined, cor = 'var(--accent)'): string {
  const v = pct != null && Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0
  return `<span class="bar"><i style="width:${v.toFixed(1)}%;background:${cor}"></i></span>`
}

const CORES_CLASSE = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)', 'var(--c7)', 'var(--c8)']
function corDaClasse(i: number): string {
  return CORES_CLASSE[i % CORES_CLASSE.length]
}

const SEVERIDADE_LABEL: Record<Severidade, string> = {
  critica: 'Crítica',
  elevada: 'Elevada',
  moderada: 'Moderada',
  baixa: 'Baixa',
}
const SEVERIDADE_CHIP: Record<Severidade, string> = { critica: 'r', elevada: 'y', moderada: 'n', baixa: 'n' }

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
const VEREDICTO_STRIPE: Record<string, string> = { manter: 'good', avaliar: 'warn', reduzir: 'crit', nao_avaliavel: '' }

const PRIORIDADE_LABEL: Record<string, string> = { alta: 'Alta prioridade', media: 'Média prioridade', baixa: 'Baixa prioridade' }
const PRIORIDADE_CHIP: Record<string, string> = { alta: 'r', media: 'y', baixa: 'n' }
const CONVICCAO_LABEL: Record<string, string> = { alta: 'Convicção alta', media: 'Convicção média', baixa: 'Convicção baixa' }

function chip(classe: string, texto: string): string {
  return `<span class="chip ${classe}">${esc(texto)}</span>`
}

function paragrafos(texto: string | null | undefined): string {
  if (!texto) return ''
  return esc(texto)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Cabeçalho de seção, com a numeração do índice. */
function sec(n: string, titulo: string, corpo: string): string {
  return `<section id="s${n}"><div class="sec-head"><span class="sec-num">${n}</span><h2>${esc(titulo)}</h2></div>
${corpo}
</section>`
}

type ValorCel = (v: number | null | undefined) => string

// ------------------------------------------------------------- construtor

const INDICE: [string, string][] = [
  ['01', 'Visão executiva'],
  ['02', 'Diagnóstico geral'],
  ['03', 'Composição da carteira'],
  ['04', 'Concentração'],
  ['05', 'Renda fixa e crédito'],
  ['06', 'Manter, avaliar, reduzir'],
  ['07', 'Ações e ETFs'],
  ['08', 'FIIs'],
  ['09', 'Exterior'],
  ['10', 'Risco'],
  ['11', 'Performance'],
  ['12', 'Fortes e atenção'],
  ['13', 'Oportunidades'],
  ['14', 'Rebalanceamento'],
  ['15', 'Plano de ação'],
  ['16', 'Top 10'],
  ['17', 'Conclusão'],
  ['18', 'Anexo técnico'],
]

export function renderRelatorioHtml(data: RelatorioData, narrativa: RelatorioNarrativa, opcoes: RenderOpcoes): string {
  const total = data.patrimonioAjustado
  const comp = data.composicao

  const valorCel: ValorCel = (v) => {
    if (v == null || !Number.isFinite(v)) return '—'
    if (opcoes.ocultarValores) {
      const p = total > 0 ? (v / total) * 100 : 0
      return sinalPct(p, Math.abs(p) < 0.1 && p !== 0 ? 3 : 1)
    }
    return formatCurrency(v)
  }

  const secoes = [
    secaoVisaoExecutiva(data, narrativa),
    secaoDiagnostico(narrativa),
    secaoComposicao(data, valorCel),
    secaoConcentracao(data, narrativa, valorCel),
    secaoRendaFixa(data, narrativa, valorCel),
    secaoListasRendaFixa(data, valorCel),
    secaoAcoes(data, narrativa, valorCel),
    secaoFiis(data, narrativa, valorCel),
    secaoExterior(narrativa),
    secaoRisco(narrativa),
    secaoPerformance(data, narrativa),
    secaoFortesAtencao(narrativa),
    secaoOportunidades(narrativa),
    secaoRebalanceamento(narrativa),
    secaoPlanoAcao(narrativa),
    secaoTop10(narrativa),
    secaoConclusao(narrativa),
    secaoAnexo(data, narrativa, valorCel),
  ]

  const indice = INDICE.map(([n, label]) => `<li><a href="#s${n}"><i>${n}</i>${esc(label)}</a></li>`).join('')

  const ajusteRegistrado =
    Math.abs(data.patrimonioRegistrado - data.patrimonioAjustado) > 1
      ? `<small>Registrado no sistema ${valorCel(data.patrimonioRegistrado)} — ver anexo</small>`
      : '<small>Base de 100% deste relatório</small>'

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
  <div class="lead"><dt>Patrimônio</dt><dd>${valorCel(data.patrimonioAjustado)}${ajusteRegistrado}</dd></div>
  <div><dt>Posições com saldo</dt><dd>${data.totais.ativosComSaldo}<small>de ${data.totais.ativos} ativos cadastrados</small></dd></div>
  <div><dt>Maior posição</dt><dd>${pct1(data.concentracao.maiorPosicaoPct)}<small>Top 10 somam ${pct1(data.concentracao.top10Pct)}</small></dd></div>
  <div><dt>Renda fixa e crédito</dt><dd>${comp ? pct1(comp.universoCredito.percentual) : '—'}<small>${comp ? 'Prazo médio ' + anosBr(comp.prazoMedioAnos) : 'Recorte indisponível'}</small></dd></div>
</dl>

<div class="layout">
<nav class="rail" aria-label="Índice"><p class="rail-h">Índice</p><ol>${indice}</ol></nav>
<main>
${secoes.join('\n')}
<footer>
  <p>Relatório gerado automaticamente pelo sistema financeiro pessoal, competência ${esc(rotuloCompetencia(data.competencia))}. Toda a aritmética (posições, alocação, composição, concentração, limiares de indiferença fiscal, veredito por papel) é calculada em código; a IA escreve apenas a análise textual, a partir desses números.</p>
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

function secaoVisaoExecutiva(data: RelatorioData, n: RelatorioNarrativa): string {
  const classes = data.alocacaoPorClasse.filter((c) => c.percentual > 0)
  const tiras = classes
    .map((c, i) => `<span style="width:${Math.max(0, c.percentual).toFixed(2)}%;background:${corDaClasse(i)}" title="${esc(c.classe)}"></span>`)
    .join('')
  const legenda = classes
    .map((c, i) => `<li><span class="dot" style="background:${corDaClasse(i)}"></span>${esc(c.classe)} <b>${pct1(c.percentual)}</b></li>`)
    .join('')

  return sec(
    '01',
    'Visão executiva',
    `<div class="prose">${paragrafos(n.resumoExecutivo.diagnostico)}</div>
  <div class="stack" role="img" aria-label="Composição da carteira por classe">${tiras}</div>
  <ul class="legend">${legenda}</ul>
  <div class="split">
    <div class="panel"><p class="pt">Principal ponto positivo</p><p>${esc(n.resumoExecutivo.pontoPositivo)}</p></div>
    <div class="panel"><p class="pt">Principal risco</p><p>${esc(n.resumoExecutivo.principalRisco)}</p></div>
    <div class="panel"><p class="pt">Principal oportunidade</p><p>${esc(n.resumoExecutivo.principalOportunidade)}</p></div>
    <div class="panel"><p class="pt">Ação prioritária</p><p>${esc(n.resumoExecutivo.acaoPrioritaria)}</p></div>
  </div>`
  )
}

function secaoDiagnostico(n: RelatorioNarrativa): string {
  return sec('02', 'Diagnóstico geral', `<div class="prose">${paragrafos(n.diagnosticoGeral)}</div>`)
}

// --- 03 · Composição: classe x alvo, vencimento, indexador, rating.

interface LinhaClasse {
  classe: string
  valor: number
  atual: number
  alvo: number
  delta: number
  ajuste: number
}

function linhasDeClasse(data: RelatorioData): LinhaClasse[] {
  const total = data.patrimonioAjustado
  const nomes = new Set<string>([...data.alocacaoPorClasse.map((c) => c.classe), ...Object.keys(CARTEIRA_ALVO)])
  return Array.from(nomes)
    .map((classe) => {
      const atualRow = data.alocacaoPorClasse.find((c) => c.classe === classe)
      const valor = atualRow?.valor ?? 0
      const atual = atualRow?.percentual ?? 0
      const alvo = CARTEIRA_ALVO[classe] ?? 0
      return { classe, valor, atual, alvo, delta: atual - alvo, ajuste: (alvo / 100) * total - valor }
    })
    .sort((a, b) => b.valor - a.valor || b.alvo - a.alvo)
}

function tabelaFatias(
  fatias: FatiaCarteira[],
  rotulo: string,
  valorCel: ValorCel,
  opcoes: { universo?: string; cor?: string } = {}
): string {
  const usaUniverso = opcoes.universo != null && fatias.some((f) => f.percentualUniverso != null)
  const linhas = fatias
    .map(
      (f) => `<tr><td>${esc(f.nome)}</td><td class="r num">${valorCel(f.valor)}</td>
      ${usaUniverso ? `<td class="r num">${pct1(f.percentualUniverso)}</td>` : ''}
      <td class="r num">${pct1(f.percentual)}</td>
      <td class="barc">${barra(usaUniverso ? f.percentualUniverso : f.percentual, opcoes.cor)}</td>
      <td class="r num mut">${f.posicoes}</td></tr>`
    )
    .join('')

  const totalValor = fatias.reduce((s, f) => s + f.valor, 0)
  const totalPct = fatias.reduce((s, f) => s + f.percentual, 0)
  const totalPos = fatias.reduce((s, f) => s + f.posicoes, 0)

  return `<div class="tw"><table><thead><tr><th>${esc(rotulo)}</th><th class="r">Valor</th>
    ${usaUniverso ? `<th class="r">% ${esc(opcoes.universo!)}</th>` : ''}
    <th class="r">% do PL</th><th></th><th class="r">Posições</th></tr></thead>
    <tbody>${linhas}</tbody>
    <tfoot><tr><td>Total</td><td class="r num">${valorCel(totalValor)}</td>${usaUniverso ? '<td class="r num">100,0%</td>' : ''}<td class="r num">${pct1(totalPct)}</td><td></td><td class="r num">${totalPos}</td></tr></tfoot>
  </table></div>`
}

function secaoComposicao(data: RelatorioData, valorCel: ValorCel): string {
  const linhas = linhasDeClasse(data)
  const linhasHtml = linhas
    .map(
      (l, i) =>
        `<tr><td>${esc(l.classe)}</td><td class="r num">${valorCel(l.valor)}</td><td class="r num">${pct1(l.atual)}</td>
        <td class="barc">${barra(l.atual, corDaClasse(i))}</td>
        <td class="r num">${pct1(l.alvo)}</td><td class="r num">${sinalPct(l.delta)}</td>
        <td class="r num">${Math.abs(l.ajuste) < 1 ? '—' : valorCel(l.ajuste)}</td></tr>`
    )
    .join('')

  const aportar = linhas.filter((l) => l.ajuste > 0).reduce((s, l) => s + l.ajuste, 0)

  const comp = data.composicao
  const blocoVencimento = comp
    ? `<h3>Por vencimento</h3>
      <p class="tnote">Escada de toda a carteira, medida a partir da data de posição. Prazo médio ponderado dos papéis com vencimento: <strong>${anosBr(comp.prazoMedioAnos)}</strong>. Vencendo nos próximos 12 meses: <strong>${pct1(comp.vencendoEm12mPct)}</strong> do patrimônio.</p>
      ${tabelaFatias(comp.porVencimento, 'Faixa de vencimento', valorCel, { cor: 'var(--c6)' })}`
    : ''

  const blocoIndexador = comp
    ? `<h3>Por indexador — renda fixa e crédito</h3>
      ${tabelaFatias(comp.porIndexador, 'Indexador', valorCel, { universo: 'da RF', cor: 'var(--c2)' })}
      <p class="tnote">Universo: ${comp.universoCredito.posicoes} papéis com remuneração contratada, ${valorCel(comp.universoCredito.valor)} (${pct1(comp.universoCredito.percentual)} do patrimônio).${comp.universoCredito.valorSemIndexador > 0 ? ` Fora deste recorte, ${valorCel(comp.universoCredito.valorSemIndexador)} em veículos de renda fixa sem indexador cadastrado (previdência, fundos abertos, ouro).` : ''}</p>`
    : ''

  const blocoRating = comp
    ? `<h3>Por rating de crédito — renda fixa</h3>
      ${tabelaFatias(comp.porRating, 'Rating', valorCel, { universo: 'da RF', cor: 'var(--c4)' })}
      <p class="tnote">Ratings informados por emissor e mantidos em <span class="mono">lib/relatorio/ratings.ts</span>; papel fora do mapa entra como “sem rating informado”, nunca como palpite. Quando o emissor tem nota em escala nacional e global, o agrupamento usa a <strong>escala nacional</strong> — ela é relativa ao risco soberano brasileiro, então um AAA(bra) não equivale a um AAA global.</p>`
    : ''

  return sec(
    '03',
    'Composição da carteira',
    `<h3>Por classe, contra a carteira-alvo</h3>
  <div class="tw"><table><thead><tr><th>Classe</th><th class="r">Valor</th><th class="r">% atual</th><th></th><th class="r">% alvo</th><th class="r">Δ p.p.</th><th class="r">Ajuste ao alvo</th></tr></thead>
  <tbody>${linhasHtml}</tbody>
  <tfoot><tr><td>Total</td><td class="r num">${valorCel(data.patrimonioAjustado)}</td><td class="r num">100,0%</td><td></td><td class="r num">100,0%</td><td></td><td class="r num">${valorCel(aportar)}</td></tr></tfoot></table></div>
  <p class="tnote">“Ajuste ao alvo” é quanto faltaria (positivo) ou sobraria (negativo) em cada classe para bater o alvo com o patrimônio de hoje; o total é o giro necessário de um lado da conta. Alvo definido pelo perfil confirmado do dono da carteira — ver <span class="mono">lib/relatorio/carteiraAlvo.ts</span>.</p>
  ${blocoVencimento}
  ${blocoIndexador}
  ${blocoRating}`
  )
}

// --- 04 · Concentração.

function secaoConcentracao(data: RelatorioData, n: RelatorioNarrativa, valorCel: ValorCel): string {
  const c = data.concentracao
  const comp = data.composicao

  const maiores = comp
    ? `<h3>Maiores posições</h3>
      <div class="tw"><table><thead><tr><th class="r">#</th><th>Papel</th><th>Classe</th><th class="r">Valor</th><th class="r">% do PL</th><th></th></tr></thead>
      <tbody>${comp.maioresPosicoes
        .map(
          (p, i) =>
            `<tr><td class="r num mut">${String(i + 1).padStart(2, '0')}</td>
            <td class="tk">${esc(p.ticker)}${p.nome && p.nome !== p.ticker ? `<small>${esc(p.nome)}</small>` : ''}</td>
            <td>${esc(p.classeEconomica)}</td><td class="r num">${valorCel(p.valor)}</td>
            <td class="r num">${pct1(p.percentual)}</td><td class="barc">${barra(p.percentual)}</td></tr>`
        )
        .join('')}</tbody>
      <tfoot><tr><td></td><td colspan="2">Soma das dez maiores</td><td class="r num">${valorCel(comp.maioresPosicoes.reduce((s, p) => s + p.valor, 0))}</td><td class="r num">${pct1(c.top10Pct)}</td><td></td></tr></tfoot></table></div>`
    : ''

  const corretora = c.porCorretora
    .map(
      (x) =>
        `<tr><td>${esc(x.nome)}</td><td class="r num">${valorCel(x.valor)}</td><td class="r num">${pct1(x.percentual)}</td><td class="barc">${barra(x.percentual, 'var(--c3)')}</td></tr>`
    )
    .join('')
  const setor = c.porSetor
    .map(
      (x) =>
        `<tr><td>${esc(x.nome)}</td><td class="r num">${valorCel(x.valor)}</td><td class="r num">${pct1(x.percentual)}</td><td class="barc">${barra(x.percentual, 'var(--c5)')}</td></tr>`
    )
    .join('')

  return sec(
    '04',
    'Concentração',
    `<div class="prose">${paragrafos(n.analiseDiversificacao)}</div>
  <div class="tw"><table><thead><tr><th>Concentração</th><th class="r">%</th><th></th></tr></thead><tbody>
    <tr><td>Maior posição individual</td><td class="r num">${pct1(c.maiorPosicaoPct)}</td><td class="barc">${barra(c.maiorPosicaoPct)}</td></tr>
    <tr><td>Top 5 posições</td><td class="r num">${pct1(c.top5Pct)}</td><td class="barc">${barra(c.top5Pct)}</td></tr>
    <tr><td>Top 10 posições</td><td class="r num">${pct1(c.top10Pct)}</td><td class="barc">${barra(c.top10Pct)}</td></tr>
  </tbody></table></div>
  ${maiores}
  <h3>Por corretora</h3>
  <div class="tw"><table><thead><tr><th>Corretora</th><th class="r">Valor</th><th class="r">% do PL</th><th></th></tr></thead><tbody>${corretora}</tbody></table></div>
  <h3>Por setor (renda variável)</h3>
  <div class="tw"><table><thead><tr><th>Setor</th><th class="r">Valor</th><th class="r">% do PL</th><th></th></tr></thead><tbody>${setor}</tbody></table></div>`
  )
}

// --- 05 e 06 · Renda fixa.

function secaoRendaFixa(data: RelatorioData, n: RelatorioNarrativa, valorCel: ValorCel): string {
  const rf = data.posicoes.filter((p) => p.ehRendaFixa && p.valorMercado > 0).sort((a, b) => b.valorMercado - a.valorMercado)
  const linhas = rf
    .map((p) => {
      const v = p.rendaFixaVeredito
      return `<tr class="sv sv-${v ? VEREDICTO_STRIPE[v.veredicto] : 'n'}">
        <td class="tk">${esc(p.ticker)}${p.nome && p.nome !== p.ticker ? `<small>${esc(p.nome)}</small>` : ''}</td>
        <td>${esc(p.categoria)}</td>
        <td>${esc(p.indexador)} ${p.taxa != null ? esc(String(p.taxa)) + '%' : ''}</td>
        <td class="mono">${p.vencimento ? esc(dataBr(p.vencimento)) : '—'}</td>
        <td>${p.rating ? esc(p.rating.texto) : '—'}${p.rating?.agencia ? `<small>${esc(p.rating.agencia)}</small>` : ''}</td>
        <td class="r num">${valorCel(p.valorMercado)}</td>
        <td class="r num">${v ? sinalPP(v.premioPontosPercentuais) : '—'}</td>
        <td>${v ? chip(VEREDICTO_CHIP[v.veredicto], VEREDICTO_LABEL[v.veredicto]) : '—'}</td>
      </tr>`
    })
    .join('')

  const l = data.limiares
  return sec(
    '05',
    'Renda fixa e crédito',
    `<div class="prose">${paragrafos(n.analiseRendaFixa)}</div>
  <div class="callout"><span class="ct">Limiares de indiferença fiscal deste mês</span>
    <ul class="tight">
      <li><strong>${l.limiarIpcaIsento != null ? 'IPCA+' + pct1(l.limiarIpcaIsento, 2) : 'indisponível'}</strong> — isento equivalente ao Tesouro IPCA+ líquido.</li>
      <li><strong>${l.limiarPreIsento != null ? pct1(l.limiarPreIsento, 2) + ' a.a.' : 'indisponível'}</strong> — isento equivalente ao Tesouro Prefixado líquido.</li>
      <li><strong>${l.tesouroSelicLiquido != null ? pct1(l.tesouroSelicLiquido, 2) + ' a.a. líquido' : 'indisponível'}</strong> — retorno do Tesouro Selic líquido de IR e custódia; base de comparação dos pós-fixados em CDI.</li>
    </ul>
  </div>
  <div class="tw"><table><thead><tr><th>Papel</th><th>Cat.</th><th>Remuneração</th><th>Venc.</th><th>Rating</th><th class="r">Valor</th><th class="r">Prêmio</th><th>Veredito</th></tr></thead>
  <tbody>${linhas}</tbody>
  <tfoot><tr><td colspan="5">Total renda fixa</td><td class="r num">${valorCel(rf.reduce((s, p) => s + p.valorMercado, 0))}</td><td colspan="2"></td></tr></tfoot></table></div>
  <p class="tnote">Prêmio em pontos percentuais de retorno ao ano, nunca em pontos de %CDI — ver <span class="mono">lib/relatorio/limiares.ts</span>.</p>`
  )
}

function secaoListasRendaFixa(data: RelatorioData, valorCel: ValorCel): string {
  const rf = data.posicoes.filter((p) => p.ehRendaFixa && p.valorMercado > 0 && p.rendaFixaVeredito)
  const grupos: Record<string, PosicaoAtivo[]> = { manter: [], avaliar: [], reduzir: [] }
  for (const p of rf) {
    const v = p.rendaFixaVeredito!.veredicto
    if (v === 'manter' || v === 'avaliar' || v === 'reduzir') grupos[v].push(p)
  }
  const lista = (titulo: string, itens: PosicaoAtivo[]) =>
    itens.length
      ? `<h3>${titulo}</h3><div class="tw"><table><thead><tr><th>Papel</th><th>Rating</th><th class="r">Valor</th><th class="r">Prêmio</th></tr></thead><tbody>${itens
          .sort((a, b) => b.valorMercado - a.valorMercado)
          .map(
            (p) =>
              `<tr><td class="tk">${esc(p.ticker)}${p.nome && p.nome !== p.ticker ? `<small>${esc(p.nome)}</small>` : ''}</td><td>${p.rating ? esc(p.rating.texto) : '—'}</td><td class="r num">${valorCel(p.valorMercado)}</td><td class="r num">${sinalPP(p.rendaFixaVeredito!.premioPontosPercentuais)}</td></tr>`
          )
          .join('')}</tbody></table></div>`
      : ''

  return sec(
    '06',
    'Renda fixa: manter, avaliar e reduzir',
    `<div class="prose"><p>Classificação automática por prêmio sobre o Tesouro equivalente (ver seção 05). “Avaliar” não é recomendação de venda — é onde o prêmio ficou pequeno demais para o prazo, e vale conferir a cotação de saída antes de decidir.</p></div>
  ${lista('🟢 Manter', grupos.manter)}
  ${lista('🟡 Avaliar', grupos.avaliar)}
  ${lista('🔴 Reduzir', grupos.reduzir)}`
  )
}

// --- 07 a 11 · Renda variável, risco e performance.

function secaoAcoes(data: RelatorioData, n: RelatorioNarrativa, valorCel: ValorCel): string {
  const total = data.patrimonioAjustado
  const acoes = data.posicoes
    .filter((p) => !p.ehRendaFixa && p.categoria !== 'FII' && p.valorMercado > 0)
    .sort((a, b) => b.valorMercado - a.valorMercado)
  const linhas = acoes
    .map(
      (p) =>
        `<tr><td class="tk">${esc(p.ticker)}${p.nome && p.nome !== p.ticker ? `<small>${esc(p.nome)}</small>` : ''}</td><td>${esc(p.categoria)}</td><td>${esc(p.setor ?? 'Não mapeado')}</td><td class="r num">${valorCel(p.valorMercado)}</td><td class="r num">${pct1(total > 0 ? (p.valorMercado / total) * 100 : 0)}</td><td class="barc">${barra(total > 0 ? (p.valorMercado / total) * 100 : 0)}</td></tr>`
    )
    .join('')

  return sec(
    '07',
    'Ações e ETFs',
    `<div class="prose">${paragrafos(n.analiseAcoes)}</div>
  <div class="tw"><table><thead><tr><th>Ativo</th><th>Categoria</th><th>Setor</th><th class="r">Valor</th><th class="r">% do PL</th><th></th></tr></thead><tbody>${linhas}</tbody>
  <tfoot><tr><td colspan="3">Total em ações e ETFs</td><td class="r num">${valorCel(acoes.reduce((s, p) => s + p.valorMercado, 0))}</td><td class="r num">${pct1(total > 0 ? (acoes.reduce((s, p) => s + p.valorMercado, 0) / total) * 100 : 0)}</td><td></td></tr></tfoot></table></div>
  <h3>ETFs</h3>
  <div class="prose">${paragrafos(n.analiseEtfs)}</div>`
  )
}

function secaoFiis(data: RelatorioData, n: RelatorioNarrativa, valorCel: ValorCel): string {
  const total = data.patrimonioAjustado
  const fiis = data.posicoes.filter((p) => p.categoria === 'FII' && p.valorMercado > 0).sort((a, b) => b.valorMercado - a.valorMercado)
  const linhas = fiis
    .map(
      (p) =>
        `<tr><td class="tk">${esc(p.ticker)}${p.nome && p.nome !== p.ticker ? `<small>${esc(p.nome)}</small>` : ''}</td><td>${esc(p.classe)}</td><td class="r num">${valorCel(p.valorMercado)}</td><td class="r num">${pct1(total > 0 ? (p.valorMercado / total) * 100 : 0)}</td></tr>`
    )
    .join('')

  return sec(
    '08',
    'FIIs',
    `<div class="prose">${paragrafos(n.analiseFiis)}</div>
  ${fiis.length ? `<div class="tw"><table><thead><tr><th>Fundo</th><th>Classe cadastrada</th><th class="r">Valor</th><th class="r">% do PL</th></tr></thead><tbody>${linhas}</tbody></table></div>` : '<p class="tnote">Nenhum FII com saldo neste mês.</p>'}`
  )
}

function secaoExterior(n: RelatorioNarrativa): string {
  return sec('09', 'Exterior', `<div class="prose">${paragrafos(n.analiseInternacional)}</div>`)
}

function secaoRisco(n: RelatorioNarrativa): string {
  return sec('10', 'Análise de risco', `<div class="prose">${paragrafos(n.analiseRisco)}</div>`)
}

function secaoPerformance(data: RelatorioData, n: RelatorioNarrativa): string {
  const l = data.limiares
  const linha = (nome: string, v: number | null, sufixo = '% a.a.') =>
    `<tr><td>${nome}</td><td class="r num">${v != null ? pct1(v, 2) + (sufixo ? ' ' + sufixo.replace('% a.a.', 'a.a.') : '') : 'indisponível'}</td></tr>`

  return sec(
    '11',
    'Performance e benchmarks',
    `<div class="prose">${paragrafos(n.performanceBenchmarks)}</div>
  <div class="tw"><table><thead><tr><th>Indicador</th><th class="r">Nível</th></tr></thead><tbody>
    ${linha('Selic meta', l.selicMeta)}
    ${linha('CDI', l.cdi)}
    ${linha('IPCA 12 meses', l.ipca12m)}
    ${linha('Ibovespa (var. 12m)', l.ibovespaVar12m)}
    ${linha('IFIX (var. 12m)', l.ifixVar12m)}
    ${linha('Tesouro IPCA+ (taxa)', l.tesouroIpcaTaxa)}
    ${linha('Tesouro Prefixado (taxa)', l.tesouroPreTaxa)}
  </tbody></table></div>
  <p class="tnote">Fonte: Selic/CDI/IPCA via Banco Central (SGS). Ibovespa/IFIX/Tesouro: ${l.benchmarksModo === 'auto' ? 'pesquisados pela IA — ' + esc(l.benchmarksFontes.join(', ') || 'fontes não registradas') : 'informados manualmente'}.</p>`
  )
}

// --- 12 a 17 · Leitura e plano.

function secaoFortesAtencao(n: RelatorioNarrativa): string {
  return sec(
    '12',
    'Pontos fortes e pontos de atenção',
    `<div class="split">
    <div class="panel"><p class="pt">Pontos fortes</p><ul class="tight">${n.pontosFortes.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
    <div class="panel"><p class="pt">Pontos de atenção</p><ul class="tight">${n.pontosAtencao.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
  </div>`
  )
}

function secaoOportunidades(n: RelatorioNarrativa): string {
  return sec('13', 'Oportunidades', `<ul class="tight">${n.oportunidades.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`)
}

function secaoRebalanceamento(n: RelatorioNarrativa): string {
  return sec(
    '14',
    'Plano de rebalanceamento',
    `<div class="prose">${paragrafos(n.carteiraAlvoComentario)}${paragrafos(n.planoRebalanceamento)}</div>
  <p class="tnote">Os números por classe, com o ajuste necessário até o alvo, estão na seção 03.</p>`
  )
}

function secaoPlanoAcao(n: RelatorioNarrativa): string {
  const bloco = (titulo: string, itens: { prioridade: string; texto: string }[]) =>
    `<h3>${titulo}</h3><ul class="acts">${itens
      .map((i) => `<li><div><p>${chip(PRIORIDADE_CHIP[i.prioridade] ?? 'n', PRIORIDADE_LABEL[i.prioridade] ?? i.prioridade)}</p><p>${esc(i.texto)}</p></div></li>`)
      .join('')}</ul>`

  return sec(
    '15',
    'Plano de ação — 30, 90 e 180 dias',
    `${bloco('Próximos 30 dias', n.planoAcao.dias30)}
  ${bloco('Próximos 90 dias', n.planoAcao.dias90)}
  ${bloco('Próximos 180 dias', n.planoAcao.dias180)}`
  )
}

function secaoTop10(n: RelatorioNarrativa): string {
  return sec(
    '16',
    'Top 10 recomendações',
    `<ol class="acts">${n.top10
      .map(
        (t, i) =>
          `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><div><h4>${esc(t.acao)}</h4>
        <dl><dt>Motivo</dt><dd>${esc(t.motivo)}</dd><dt>Impacto</dt><dd>${esc(t.impactoEsperado)}</dd><dt>Risco</dt><dd>${esc(t.risco)}</dd><dt>Prazo</dt><dd>${esc(t.prazo)}</dd><dt>Convicção</dt><dd>${esc(CONVICCAO_LABEL[t.conviccao] ?? t.conviccao)}</dd></dl>
        </div></li>`
      )
      .join('')}</ol>`
  )
}

function secaoConclusao(n: RelatorioNarrativa): string {
  return sec('17', 'Conclusão executiva', `<div class="prose"><p class="big-verdict">${esc(n.conclusaoExecutiva)}</p></div>`)
}

// --- 18 · Anexo técnico: premissas e qualidade de dado.

function secaoAnexo(data: RelatorioData, n: RelatorioNarrativa, valorCel: ValorCel): string {
  const l = data.limiares
  const criticos = data.alertas.filter((a) => a.severidade === 'critica')
  const resto = data.alertas.filter((a) => a.severidade !== 'critica')

  const calloutCritico = (a: AlertaQualidade) =>
    `<div class="callout crit"><span class="ct">Crítica${a.valorEnvolvido != null ? ' · ' + valorCel(a.valorEnvolvido) : ''}</span>
      <p><strong>${esc(a.titulo)}</strong></p><p>${esc(a.descricao)}</p></div>`

  const tabelaResto = resto.length
    ? `<div class="tw"><table><thead><tr><th>Severidade</th><th>Observação</th><th class="r">Valor</th></tr></thead><tbody>${resto
        .map(
          (a) =>
            `<tr><td>${chip(SEVERIDADE_CHIP[a.severidade], SEVERIDADE_LABEL[a.severidade])}</td><td><strong>${esc(a.titulo)}</strong><br><span class="mut">${esc(a.descricao)}</span></td><td class="r num">${a.valorEnvolvido != null ? valorCel(a.valorEnvolvido) : '—'}</td></tr>`
        )
        .join('')}</tbody></table></div>`
    : '<p class="tnote">Nenhuma observação de qualidade de dado além das acima.</p>'

  return sec(
    '18',
    'Anexo técnico — premissas e qualidade dos dados',
    `<h3>Premissas</h3>
  <ul class="tight">
    <li>Alíquota de IR assumida: ${pct1(l.aliquotaIrPremissa * 100)} (prazo &gt; 720 dias). Custódia B3: ${pct1(l.custodiaB3Premissa * 100)} a.a.</li>
    <li>Benchmarks de mercado: ${l.benchmarksModo === 'auto' ? 'pesquisados pela IA em ' + esc(dataBr(l.benchmarksGeradoEm)) : 'informados manualmente na geração deste relatório'}.</li>
    <li>Base do relatório: ${data.totais.ativos} ativos cadastrados, ${data.totais.ativosComSaldo} com saldo, ${data.totais.movimentacoes} movimentações. Patrimônio registrado ${valorCel(data.patrimonioRegistrado)}; patrimônio ajustado (100% deste relatório) ${valorCel(data.patrimonioAjustado)}.</li>
    ${n.riscosPremissas.map((p) => `<li>${esc(p)}</li>`).join('')}
  </ul>
  <h3>Qualidade dos dados</h3>
  ${criticos.length ? criticos.map(calloutCritico).join('') : '<div class="callout good"><span class="ct">Sem bloqueios</span><p>Nenhum alerta crítico neste mês — o patrimônio ajustado é igual ao registrado.</p></div>'}
  ${tabelaResto}`
  )
}

// ------------------------------------------------------------------ CSS

const CSS = `
:root{--paper:#F6F7F4;--surface:#FCFCFB;--surface-2:#EFF1EC;--surface-3:#E6E9E2;--ink:#141A17;--ink-2:#3D4741;--muted:#6B746E;--rule:#DCDFD8;--rule-strong:#B6BCB3;--accent:#00756D;--accent-soft:#E0EFEC;--good:#2C7A4B;--good-bg:#E6F1EA;--good-line:#2C7A4B;--warn:#946705;--warn-bg:#F6EEDA;--warn-line:#B98A12;--crit:#A6382F;--crit-bg:#F7E8E6;--crit-line:#A6382F;--c1:#00756D;--c2:#2C7A4B;--c3:#946705;--c4:#6B5CA5;--c5:#A6382F;--c6:#3D7AA6;--c7:#8A7A4E;--c8:#6B746E}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--paper:#121614;--surface:#181D1A;--surface-2:#1E2420;--surface-3:#262D28;--ink:#E9ECE7;--ink-2:#C1C8C0;--muted:#8D958E;--rule:#2B322D;--rule-strong:#414A44;--accent:#45C4B7;--accent-soft:#12302C;--good:#63C288;--good-bg:#152A1E;--good-line:#3E9E63;--warn:#DCAC42;--warn-bg:#2A2414;--warn-line:#B98A12;--crit:#E37A70;--crit-bg:#2D1C1A;--crit-line:#B9564B;--c1:#45C4B7;--c2:#63C288;--c3:#DCAC42;--c4:#A89AE0;--c5:#E37A70;--c6:#7FB6DC;--c7:#C9B67E;--c8:#8D958E}}
:root[data-theme="dark"]{--paper:#121614;--surface:#181D1A;--surface-2:#1E2420;--surface-3:#262D28;--ink:#E9ECE7;--ink-2:#C1C8C0;--muted:#8D958E;--rule:#2B322D;--rule-strong:#414A44;--accent:#45C4B7;--accent-soft:#12302C;--good:#63C288;--good-bg:#152A1E;--good-line:#3E9E63;--warn:#DCAC42;--warn-bg:#2A2414;--warn-line:#B98A12;--crit:#E37A70;--crit-bg:#2D1C1A;--crit-line:#B9564B;--c1:#45C4B7;--c2:#63C288;--c3:#DCAC42;--c4:#A89AE0;--c5:#E37A70;--c6:#7FB6DC;--c7:#C9B67E;--c8:#8D958E}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Libre Franklin",-apple-system,sans-serif;font-size:16px;line-height:1.6}
.shell{max-width:1180px;margin:0 auto;padding:0 24px 80px}
.prose{max-width:70ch}
p{margin:0 0 1em}
a{color:var(--accent)}
strong{font-weight:600;color:var(--ink)}
.mono{font-family:"IBM Plex Mono",monospace}
.num{font-variant-numeric:tabular-nums}
.mut{color:var(--muted)}
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
.ledger dd small{display:block;font-family:"Libre Franklin",sans-serif;font-size:11px;color:var(--muted);margin-top:6px;line-height:1.35}
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
.stack{display:flex;width:100%;height:16px;margin:22px 0 12px;overflow:hidden;background:var(--surface-2);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.stack span{display:block;height:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.legend{list-style:none;display:flex;flex-wrap:wrap;gap:6px 20px;margin:0 0 24px;padding:0;font-size:12.5px;color:var(--ink-2)}
.legend li{display:flex;align-items:center;gap:7px}
.legend b{font-variant-numeric:tabular-nums;color:var(--ink)}
.legend .dot{width:9px;height:9px;border-radius:2px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.callout{background:var(--surface);border:1px solid var(--rule);border-left:3px solid var(--accent);padding:16px 18px;margin:18px 0}
.callout.crit{border-left-color:var(--crit-line);background:var(--crit-bg)}
.callout.warn{border-left-color:var(--warn-line);background:var(--warn-bg)}
.callout.good{border-left-color:var(--good-line);background:var(--good-bg)}
.callout .ct{font-family:"IBM Plex Mono",monospace;font-size:10.5px;text-transform:uppercase;color:var(--muted);display:block;margin:0 0 8px}
.callout.crit .ct{color:var(--crit)}.callout.warn .ct{color:var(--warn)}.callout.good .ct{color:var(--good)}
.tw{overflow-x:auto;margin:18px 0;border-top:1px solid var(--rule-strong);border-bottom:1px solid var(--rule-strong)}
table{border-collapse:collapse;width:100%;min-width:520px;font-size:13.5px}
thead th{font-family:"IBM Plex Mono",monospace;font-size:10px;text-transform:uppercase;color:var(--muted);text-align:left;padding:10px 10px 9px;border-bottom:1px solid var(--rule-strong);white-space:nowrap}
tbody td{padding:8px 10px;border-bottom:1px solid var(--rule);vertical-align:top}
tbody tr:last-child td{border-bottom:0}
th.r,td.r{text-align:right}
td.tk{font-family:"IBM Plex Mono",monospace;font-size:12.5px;font-weight:500;white-space:nowrap}
td.tk small,td small{display:block;font-family:"Libre Franklin",sans-serif;font-size:11px;font-weight:400;color:var(--muted);white-space:normal;margin-top:2px}
td.barc{width:110px;min-width:90px;padding-top:13px}
.bar{display:block;height:6px;background:var(--surface-3);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.bar>i{display:block;height:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact}
tfoot td{padding:9px 10px;border-top:1px solid var(--rule-strong);font-weight:600}
.tnote{font-size:12px;color:var(--muted);margin:8px 0 0;max-width:80ch}
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
.split{display:grid;gap:20px;grid-template-columns:1fr;margin:20px 0}
@media(min-width:760px){.split{grid-template-columns:1fr 1fr}}
.panel{background:var(--surface);border:1px solid var(--rule);padding:16px 18px}
.panel ul.tight{margin:0;padding-left:18px}
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
  :root,:root[data-theme="dark"],:root:not([data-theme="light"]){--paper:#fff;--surface:#FBFBF9;--ink:#141A17;--ink-2:#3D4741;--muted:#5E6862;--rule:#D3D7CE;--rule-strong:#9AA197;--accent:#00655E;--c1:#00756D;--c2:#2C7A4B;--c3:#946705;--c4:#6B5CA5;--c5:#A6382F;--c6:#3D7AA6;--c7:#8A7A4E;--c8:#6B746E}
  .rail{display:none!important}
  .layout{display:block}
  .tw{overflow:visible}
  table{font-size:10.5px}
  tr,.callout,.panel,.acts li,.stack{break-inside:avoid}
  h2,h3,.sec-head{break-after:avoid}
}
`
