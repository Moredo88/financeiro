'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'

/**
 * Tarefa simples: [dia, texto]. Checkpoint: [dia, 'checkpoint', texto] — o
 * marcador extra e o que diferencia os dois no render (destaque ambar e
 * contagem separada de checkpoints).
 */
type TarefaSimples = readonly [dia: string, texto: string]
type TarefaCheckpoint = readonly [dia: string, marcador: 'checkpoint', texto: string]
type Tarefa = TarefaSimples | TarefaCheckpoint
type Recurso = readonly [label: string, url: string]

interface Semana {
  name: string
  tasks: Tarefa[]
  resources: Recurso[]
}

interface Fase {
  phase: string
  weeks: Semana[]
}

const DATA: Fase[] = [
  {
    phase: 'Fase 1 — Fundamentos e Domínio do Profit Pro',
    weeks: [
      {
        name: 'Instalação e primeiros passos',
        tasks: [
          ['Seg', 'Instalar Profit Pro (ou solicitar teste grátis de 15 dias) e configurar a conta demo'],
          ["Ter", "Assistir 'Instalando a Plataforma Profit | Profit na Prática' e montar o primeiro gráfico"],
          ['Qua', 'Aula 1 Nelogica: abertura de menu e configuração de tela'],
          ['Qui', 'Estudar especificações do mini índice (WIN) e mini dólar (WDO) na B3'],
          ['Sex', 'Aula 2 Nelogica: configurar Book de Ofertas e Times & Trades'],
        ],
        resources: [
          ['Teste grátis Profit Pro (15 dias)', 'https://www.nelogica.com.br/promo?strSlug=youtube-profit'],
          ['Vídeo: Instalando a Plataforma Profit', 'https://www.youtube.com/watch?v=qMIFvSUuusY'],
          ['Aprendendo a usar o Profit Pro (Aulas 1-6)', 'https://ajuda.nelogica.com.br/hc/pt-br/articles/360041173631-Aprendendo-a-usar-o-Profit-Pro'],
          ['B3 Educação — Futuro Mini de Ibovespa (WIN)', 'https://edu.b3.com.br/w/mini-indice'],
          ['B3 Educação — Futuro Mini de Dólar (WDO)', 'https://edu.b3.com.br/w/mini-dolar'],
        ],
      },
      {
        name: 'Ferramentas do Profit Pro',
        tasks: [
          ['Seg', 'Aula 3 Nelogica: filtros e visualizações (lado, agente, tamanho de lote, agressores)'],
          ['Ter', 'Configurar indicadores básicos: médias móveis e RSI'],
          ['Qua', 'Aula 4 Nelogica: envio de ordens e ordem OCO em conta demo'],
          ['Qui', 'Praticar timeframes, candles e volume em 3 ativos diferentes'],
          ['Sex', 'Revisão da semana: registrar 5 observações de mercado no diário de trade'],
        ],
        resources: [
          ['Profit Training (simulador)', 'https://www.nelogica.com.br/produtos/profit-training'],
          ['Aprendendo a usar o Profit Pro (Aulas 1-6)', 'https://ajuda.nelogica.com.br/hc/pt-br/articles/360041173631-Aprendendo-a-usar-o-Profit-Pro'],
        ],
      },
      {
        name: 'Gerenciamento de risco e Day Trade',
        tasks: [
          ['Seg', 'Aula 5 Nelogica: gerenciamento de risco (stop loss/gain) configurado no Profit'],
          ['Ter', "Curso 'Introdução ao Day Trade' (Nelogica Academy) — módulos iniciais"],
          ['Qua', 'Curso Day Trade: book de ofertas x tape reading'],
          ['Qui', 'Curso Day Trade: módulos finais, mindset e disciplina'],
          [
            'Sex',
            'checkpoint',
            'Checkpoint 1 — Instalar o Profit sozinho, configurar 3 monitores de gráfico com indicadores e montar/enviar (simulado) uma ordem OCO com stop definido, sem consultar tutorial',
          ],
        ],
        resources: [
          ['Curso gratuito: Introdução ao Day Trade', 'https://lp.nelogica.com.br/nelogica-academy-curso-intr-day-trade'],
          ['Aprendendo a usar o Profit Pro (Aula 5 — risco)', 'https://ajuda.nelogica.com.br/hc/pt-br/articles/360041173631-Aprendendo-a-usar-o-Profit-Pro'],
        ],
      },
    ],
  },
  {
    phase: 'Fase 2 — Análise Técnica, Tape Reading e Simulação',
    weeks: [
      {
        name: 'Análise técnica essencial',
        tasks: [
          ['Seg', 'Identificar suportes e resistências em 3 ativos diferentes no Profit'],
          ['Ter', 'Aplicar médias móveis curta/longa e cruzamentos em WIN/WDO'],
          ['Qua', 'Reconhecer padrões de candles (engolfo, martelo, doji) em gráfico real'],
          ['Qui', 'Configurar e interpretar Volume e VWAP no Profit'],
          ['Sex', 'Revisão: registrar 5 setups técnicos observados no diário de trade'],
        ],
        resources: [
          ['Aprendendo a usar o Profit Pro', 'https://ajuda.nelogica.com.br/hc/pt-br/articles/360041173631-Aprendendo-a-usar-o-Profit-Pro'],
        ],
      },
      {
        name: 'Tape reading e leitura de fluxo',
        tasks: [
          ['Seg', 'Fundamentos de tape reading: leitura do Times & Trades'],
          ['Ter', 'Identificar absorção e agressão compradora/vendedora no book'],
          ['Qua', 'Praticar leitura de fluxo por 1h no Profit Training'],
          ['Qui', 'Combinar tape reading + suporte/resistência em 3 operações simuladas'],
          ['Sex', 'Revisão da semana: anotar acertos e erros no diário de trade'],
        ],
        resources: [['Profit Training (simulador)', 'https://www.nelogica.com.br/produtos/profit-training']],
      },
      {
        name: 'Backtesting e simulação',
        tasks: [
          ['Seg', 'Configurar um backtest simples de uma estratégia no Profit'],
          ['Ter', 'Rodar o backtest e interpretar taxa de acerto e payoff'],
          ['Qua', 'Operar 5 trades simulados no Profit Training seguindo plano escrito'],
          ['Qui', 'Aula 6 Nelogica: acompanhar posições, ganhos e performance'],
          [
            'Sex',
            'checkpoint',
            'Checkpoint 2 — Executar e documentar 10 operações simuladas consecutivas no Profit Training, com stop/gain definidos antes da entrada, calculando taxa de acerto e payoff',
          ],
        ],
        resources: [
          ['Profit Training (simulador)', 'https://www.nelogica.com.br/produtos/profit-training'],
          ['Aprendendo a usar o Profit Pro (Aula 6 — resultados)', 'https://ajuda.nelogica.com.br/hc/pt-br/articles/360041173631-Aprendendo-a-usar-o-Profit-Pro'],
        ],
      },
    ],
  },
  {
    phase: 'Fase 3 — Derivativos e Operações Estruturadas',
    weeks: [
      {
        name: 'Fundamentos de derivativos',
        tasks: [
          ['Seg', "B3 Educação: 'Conheça Derivativos e suas Estratégias' (futuro, termo, opções, swap)"],
          ['Ter', 'Aprofundar contratos futuros: WIN, WDO e ajuste diário'],
          ['Qua', 'Mercado a termo: conceito e uso prático'],
          ['Qui', 'Introdução a Swaps: funcionamento básico'],
          ['Sex', 'Revisão: escrever as diferenças entre os 4 tipos de derivativos'],
        ],
        resources: [
          ['B3 Educação — Conheça Derivativos e suas Estratégias', 'https://edu.b3.com.br/w/conheca-derivativos-e-suas-estrategias'],
          ['Portal B3 Educação (hub completo)', 'https://edu.b3.com.br/'],
        ],
      },
      {
        name: 'Opções: conceitos e gregas',
        tasks: [
          ['Seg', "B3 Educação: 'Opções' (call/put, americano/europeu, ITM/ATM/OTM)"],
          ['Ter', "B3 Educação: 'Investindo com Opções' (aplicações em carteira)"],
          ['Qua', 'Gregas: Delta, Gamma, Theta, Vega — intuição prática'],
          ['Qui', 'Precificação: visão geral de Black-Scholes, sem aprofundar na matemática'],
          ['Sex', 'Revisão: montar no papel uma call e uma put hipotéticas com strike e vencimento'],
        ],
        resources: [
          ['B3 Educação — Opções', 'https://edu.b3.com.br/w/opcoes'],
          ['B3 Educação — Investindo com Opções', 'https://edu.b3.com.br/w/investindo-com-opcoes'],
          ['B3 Educação — Opções sobre Ações', 'https://edu.b3.com.br/w/opcoes-acoes'],
        ],
      },
      {
        name: 'Operações estruturadas',
        tasks: [
          ['Seg', 'Travas de alta e travas de baixa: mecânica e payoff'],
          ['Ter', 'Borboletas e combinações com o ativo-objeto'],
          ['Qua', "B3 Educação: 'Opções sobre Ibovespa' e 'Opções sobre Dólar' (estruturas em índice/câmbio)"],
          ['Qui', 'Simular (no papel ou em demo) uma trava de alta com dados reais de mercado'],
          [
            'Sex',
            'checkpoint',
            'Checkpoint 3 — Explicar a mecânica de uma trava de alta e uma trava de baixa, e montar (simulado) uma estrutura com ganho e perda máxima definidos',
          ],
        ],
        resources: [
          ['B3 Educação — Opções sobre Ibovespa', 'https://edu.b3.com.br/w/opcoes-ibovespab3'],
          ['B3 Educação — Opções sobre Dólar', 'https://edu.b3.com.br/w/opcoes-dolar'],
        ],
      },
    ],
  },
  {
    phase: 'Fase 4 — Estratégia, Automação e Validação Final',
    weeks: [
      {
        name: 'Construção do plano de trading',
        tasks: [
          ['Seg', 'Definir seu perfil operacional (day trade / swing trade) e mercados de atuação'],
          ['Ter', 'Escrever regras de entrada e saída (checklist de setup)'],
          ['Qua', 'Definir regras de gestão de risco (% de capital por operação, stop máximo diário)'],
          ['Qui', 'Criar modelo de diário de trade (planilha ou caderno)'],
          ['Sex', 'Revisar o plano escrito criticamente antes de seguir para automação'],
        ],
        resources: [],
      },
      {
        name: 'Introdução à automação de estratégias',
        tasks: [
          ['Seg', "Curso gratuito 'Automação de Estratégias no Profit' — editor de estratégias"],
          ['Ter', 'Declaração de parâmetros de entrada e variáveis'],
          ['Qua', 'Tipos de dados e séries de dados na linguagem do Profit'],
          ['Qui', 'Montar uma estratégia simples (ex: cruzamento de médias) em ambiente de simulação'],
          ['Sex', 'Rodar a estratégia simples em backtest e revisar os resultados'],
        ],
        resources: [
          ['Curso: Automação de Estratégias no Profit', 'https://www.invest.academy/pt/courselp/68'],
          ['Central de Ajuda Nelogica', 'https://ajuda.nelogica.com.br/'],
        ],
      },
      {
        name: 'Validação final e continuidade',
        tasks: [
          ['Seg', 'Operar 5 sessões simuladas seguindo o plano de trading integralmente'],
          ['Ter', 'Revisar o diário de trade das últimas 12 semanas e identificar padrões de erro'],
          ['Qua', 'Calcular métricas finais: taxa de acerto, payoff e drawdown máximo simulado'],
          ['Qui', 'Definir plano de estudo contínuo para os próximos 90 dias'],
          [
            'Sex',
            'checkpoint',
            'Checkpoint Final — Apresentar um relatório de performance simulada de 12 semanas (taxa de acerto, payoff, drawdown) e um plano de trading escrito antes de considerar operar com capital real',
          ],
        ],
        resources: [['Profit Training (simulador)', 'https://www.nelogica.com.br/produtos/profit-training']],
      },
    ],
  },
]

function ehCheckpoint(t: Tarefa): t is TarefaCheckpoint {
  return t.length === 3
}

export default function PlanoTradingPage() {
  // Tarefas concluidas ficam em plano_trading_progresso (uma linha por
  // tarefa marcada, dono-a-dono). semanaAberta e so estado de UI —
  // continua vivendo apenas na sessao da pagina, sem gravar no banco.
  const [marcadas, setMarcadas] = useState<Record<string, boolean>>({})
  const [semanaAberta, setSemanaAberta] = useState<Record<number, boolean>>({ 0: true })
  const [erro, setErro] = useState<string | null>(null)

  const supabase = useMemo(() => createClient(), [])

  const carregar = useCallback(async () => {
    const { data, error } = await supabase.from('plano_trading_progresso').select('tarefa_chave')

    if (error) {
      // Tabela ausente = migracao ainda nao rodada. O Postgres devolve
      // 42P01; o PostgREST, que responde pelo cache de schema, devolve
      // PGRST205 antes mesmo de consultar o banco.
      const semTabela =
        error.code === '42P01' || error.code === 'PGRST205' || /schema cache/i.test(error.message)

      setErro(
        semTabela
          ? 'A tabela de progresso ainda nao existe no banco. Rode a migracao supabase/migrations/20260827_plano_trading_progresso.sql no SQL Editor do Supabase.'
          : `Nao foi possivel carregar o progresso: ${error.message}`
      )
      return
    }

    setErro(null)
    const carregadas: Record<string, boolean> = {}
    for (const row of data ?? []) carregadas[row.tarefa_chave] = true
    setMarcadas(carregadas)
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  const semanas = useMemo(() => {
    const out: { fase: Fase; semana: Semana; indice: number }[] = []
    let indice = 0
    DATA.forEach((fase) => {
      fase.weeks.forEach((semana) => {
        out.push({ fase, semana, indice })
        indice++
      })
    })
    return out
  }, [])

  const totalTarefas = useMemo(() => semanas.reduce((acc, s) => acc + s.semana.tasks.length, 0), [semanas])

  const totaisPorSemana = useMemo(
    () =>
      semanas.map(({ semana, indice }) => ({
        marcadas: semana.tasks.filter((_, tIdx) => marcadas[`${indice}-${tIdx}`]).length,
        total: semana.tasks.length,
      })),
    [semanas, marcadas]
  )

  const concluidas = totaisPorSemana.reduce((acc, s) => acc + s.marcadas, 0)

  const checkpointsConcluidos = useMemo(() => {
    let c = 0
    semanas.forEach(({ semana, indice }) => {
      semana.tasks.forEach((t, tIdx) => {
        if (ehCheckpoint(t) && marcadas[`${indice}-${tIdx}`]) c++
      })
    })
    return c
  }, [semanas, marcadas])

  const totalCheckpoints = useMemo(() => semanas.reduce((acc, s) => acc + s.semana.tasks.filter(ehCheckpoint).length, 0), [semanas])

  const pct = totalTarefas ? Math.round((concluidas / totalTarefas) * 100) : 0

  const pontosCurva = useMemo(() => {
    const n = totaisPorSemana.length
    const stepX = 600 / (n - 1 || 1)
    let cumMarcadas = 0
    let cumTotal = 0
    return totaisPorSemana
      .map((s, i) => {
        cumMarcadas += s.marcadas
        cumTotal += s.total
        const frac = cumTotal ? cumMarcadas / cumTotal : 0
        const y = 85 - frac * 75
        return `${(i * stepX).toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }, [totaisPorSemana])

  async function alternarTarefa(indiceSemana: number, indiceTarefa: number) {
    const chave = `${indiceSemana}-${indiceTarefa}`
    const concluida = !marcadas[chave]

    // Otimista: o check responde na hora, sem esperar o servidor.
    setMarcadas((prev) => ({ ...prev, [chave]: concluida }))

    const { error } = concluida
      ? await supabase
          .from('plano_trading_progresso')
          .upsert({ tarefa_chave: chave }, { onConflict: 'user_id,tarefa_chave' })
      : await supabase.from('plano_trading_progresso').delete().eq('tarefa_chave', chave)

    if (error) {
      // Servidor recusou: desfaz o otimismo e avisa.
      setMarcadas((prev) => ({ ...prev, [chave]: !concluida }))
      alert(`Nao foi possivel salvar o progresso: ${error.message}`)
    }
  }

  function alternarSemana(indice: number) {
    setSemanaAberta((prev) => ({ ...prev, [indice]: !prev[indice] }))
  }

  return (
    <div className="plano-trading rounded-xl border border-[#232B35] bg-[#0B0F14] p-5 text-[#E6EAEE] sm:p-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .plano-trading{
          --pt-surface:#12181F;
          --pt-surface2:#161D26;
          --pt-line:#232B35;
          --pt-muted:#8B97A5;
          --pt-up:#3ECF8E;
          --pt-amber:#E8A33D;
          --pt-amber-dim:rgba(232,163,61,0.12);
          font-family:'IBM Plex Sans',sans-serif;
          -webkit-font-smoothing:antialiased;
        }
        .plano-trading .pt-mono{ font-family:'IBM Plex Mono',monospace; }
        .plano-trading .pt-eyebrow{
          font-family:'IBM Plex Mono',monospace;
          font-size:11px;
          letter-spacing:.14em;
          text-transform:uppercase;
          color:var(--pt-up);
          display:flex;align-items:center;gap:8px;
        }
        .plano-trading .pt-eyebrow::before{content:"●";font-size:8px;}
        .plano-trading h1{
          font-family:'Space Grotesk',sans-serif;
          font-weight:700;
          font-size:clamp(22px,4vw,32px);
          line-height:1.15;
          margin:8px 0 6px;
        }
        .plano-trading .pt-sub{color:var(--pt-muted);font-size:14.5px;line-height:1.55;max-width:640px;margin:0;}
        .plano-trading .pt-panel{
          background:var(--pt-surface);
          border:1px solid var(--pt-line);
          border-radius:10px;
          padding:18px 20px;
          margin-top:22px;
        }
        .plano-trading .pt-curve-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px;}
        .plano-trading .pt-curve-label{font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--pt-muted);letter-spacing:.08em;text-transform:uppercase;}
        .plano-trading .pt-curve-value{font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:600;color:var(--pt-up);}
        .plano-trading .pt-curve-svg{width:100%;height:90px;display:block;}
        .plano-trading .pt-bar-track{height:6px;background:var(--pt-surface2);border-radius:3px;overflow:hidden;margin-top:10px;border:1px solid var(--pt-line);}
        .plano-trading .pt-bar-fill{height:100%;background:linear-gradient(90deg,#2AA876,var(--pt-up));transition:width .35s ease;}
        .plano-trading .pt-stats-row{display:flex;flex-wrap:wrap;gap:22px;margin-top:10px;font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--pt-muted);}
        .plano-trading .pt-stats-row b{color:#E6EAEE;}
        .plano-trading .pt-phase{margin-top:34px;}
        .plano-trading .pt-phase-title{
          font-family:'Space Grotesk',sans-serif;
          font-size:12px;
          letter-spacing:.12em;
          text-transform:uppercase;
          color:var(--pt-amber);
          display:flex;
          align-items:center;
          gap:10px;
          margin-bottom:14px;
        }
        .plano-trading .pt-phase-title::after{content:"";flex:1;height:1px;background:var(--pt-line);}
        .plano-trading .pt-week{
          background:var(--pt-surface);
          border:1px solid var(--pt-line);
          border-radius:10px;
          margin-bottom:12px;
          overflow:hidden;
        }
        .plano-trading .pt-week-head{
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:13px 16px;
          cursor:pointer;
          user-select:none;
        }
        .plano-trading .pt-week-head:hover{background:var(--pt-surface2);}
        .plano-trading .pt-week-title{display:flex;align-items:baseline;gap:10px;min-width:0;}
        .plano-trading .pt-week-num{font-family:'IBM Plex Mono',monospace;color:var(--pt-up);font-size:13px;flex-shrink:0;}
        .plano-trading .pt-week-name{font-weight:600;font-size:14.5px;}
        .plano-trading .pt-week-meta{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--pt-muted);display:flex;align-items:center;gap:10px;flex-shrink:0;}
        .plano-trading .pt-week-body-inner{border-top:1px solid var(--pt-line);}
        .plano-trading .pt-task-list{list-style:none;margin:0;padding:10px 16px 14px;}
        .plano-trading .pt-task{
          display:flex;
          align-items:flex-start;
          gap:10px;
          padding:8px 4px;
          border-bottom:1px dashed var(--pt-line);
        }
        .plano-trading .pt-task:last-child{border-bottom:none;}
        .plano-trading .pt-task input{
          margin-top:3px;
          width:16px;height:16px;
          accent-color:var(--pt-up);
          cursor:pointer;
          flex-shrink:0;
        }
        .plano-trading .pt-task label{font-size:13.5px;line-height:1.5;cursor:pointer;}
        .plano-trading .pt-day{font-family:'IBM Plex Mono',monospace;color:var(--pt-muted);font-size:11px;margin-right:6px;}
        .plano-trading .pt-task--checked label{color:var(--pt-muted);text-decoration:line-through;text-decoration-color:var(--pt-line);}
        .plano-trading .pt-task--checkpoint{background:var(--pt-amber-dim);border-radius:6px;border-bottom:none;margin-top:4px;padding:10px;}
        .plano-trading .pt-task--checkpoint .pt-day{color:var(--pt-amber);}
        .plano-trading .pt-task--checkpoint:not(.pt-task--checked) input{accent-color:var(--pt-amber);}
        .plano-trading .pt-resources{padding:0 16px 16px;}
        .plano-trading .pt-res-label{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--pt-muted);margin:6px 0 8px;}
        .plano-trading .pt-res-list{display:flex;flex-wrap:wrap;gap:8px;}
        .plano-trading .pt-res-list a{
          font-size:12px;
          color:#E6EAEE;
          background:var(--pt-surface2);
          border:1px solid var(--pt-line);
          padding:6px 10px;
          border-radius:6px;
          text-decoration:none;
        }
        .plano-trading .pt-res-list a:hover{border-color:var(--pt-up);color:var(--pt-up);}
        .plano-trading .pt-error{
          margin-top:16px;
          padding:12px 14px;
          border-radius:8px;
          background:var(--pt-amber-dim);
          border:1px solid var(--pt-amber);
          color:var(--pt-amber);
          font-size:12.5px;
          line-height:1.6;
          display:flex;
          flex-wrap:wrap;
          align-items:center;
          gap:10px;
        }
        .plano-trading .pt-error-retry{
          font-family:'IBM Plex Mono',monospace;
          font-size:11px;
          text-transform:uppercase;
          letter-spacing:.06em;
          color:var(--pt-amber);
          background:transparent;
          border:1px solid var(--pt-amber);
          border-radius:6px;
          padding:4px 8px;
          cursor:pointer;
        }
        .plano-trading .pt-error-retry:hover{background:var(--pt-amber-dim);}
        .plano-trading .pt-disclaimer{
          margin-top:30px;
          font-size:12px;
          color:var(--pt-muted);
          line-height:1.6;
          border-top:1px solid var(--pt-line);
          padding-top:16px;
        }
      `}</style>

      <div className="pt-eyebrow">Plano de estudo · 1h/dia · Profit Pro</div>
      <h1>Formação em Trading &amp; Operações Estruturadas</h1>
      <p className="pt-sub">
        Trilha de 12 semanas, com estudo diário de ~1 hora, cobrindo domínio da plataforma Profit Pro, análise
        técnica e tape reading, derivativos e operações estruturadas com opções, e construção de um plano de
        trading validado antes de qualquer operação com capital real.
      </p>

      {erro && (
        <div className="pt-error">
          {erro}
          <button type="button" onClick={carregar} className="pt-error-retry">
            Tentar novamente
          </button>
        </div>
      )}

      <div className="pt-panel">
        <div className="pt-curve-head">
          <span className="pt-curve-label">Progresso acumulado</span>
          <span className="pt-curve-value">{pct}%</span>
        </div>
        <svg className="pt-curve-svg" viewBox="0 0 600 90" preserveAspectRatio="none">
          <line x1="0" y1="89" x2="600" y2="89" stroke="#232B35" strokeWidth="1" />
          <polyline points={pontosCurva} fill="none" stroke="#3ECF8E" strokeWidth="2" />
        </svg>
        <div className="pt-bar-track">
          <div className="pt-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="pt-stats-row">
          <span>
            <b>{concluidas}</b>/{totalTarefas} tarefas concluídas
          </span>
          <span>
            <b>{checkpointsConcluidos}</b>/{totalCheckpoints} checkpoints validados
          </span>
        </div>
      </div>

      {DATA.map((fase) => (
        <div key={fase.phase} className="pt-phase">
          <div className="pt-phase-title">{fase.phase}</div>

          {fase.weeks.map((semana) => {
            const { indice } = semanas.find((s) => s.semana === semana)!
            const aberta = !!semanaAberta[indice]
            const total = totaisPorSemana[indice]

            return (
              <div key={semana.name} className="pt-week">
                <div className="pt-week-head" onClick={() => alternarSemana(indice)}>
                  <div className="pt-week-title">
                    <span className="pt-week-num">S{indice + 1}</span>
                    <span className="pt-week-name">{semana.name}</span>
                  </div>
                  <div className="pt-week-meta">
                    <span>
                      {total.marcadas}/{total.total}
                    </span>
                    <span
                      className={clsx('inline-block transition-transform duration-200 ease-in-out', aberta && 'rotate-90')}
                    >
                      ▸
                    </span>
                  </div>
                </div>

                <div
                  className={clsx(
                    'grid transition-[grid-template-rows] duration-200 ease-in-out',
                    aberta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="pt-week-body-inner">
                      <ul className="pt-task-list">
                        {semana.tasks.map((t, tIdx) => {
                          const checkpoint = ehCheckpoint(t)
                          const dia = checkpoint ? 'Checkpoint' : t[0]
                          const texto = checkpoint ? t[2] : t[1]
                          const chave = `${indice}-${tIdx}`
                          const marcada = !!marcadas[chave]
                          const id = `pt-task-${chave}`

                          return (
                            <li
                              key={tIdx}
                              className={clsx(
                                'pt-task',
                                checkpoint && 'pt-task--checkpoint',
                                marcada && 'pt-task--checked'
                              )}
                            >
                              <input
                                type="checkbox"
                                id={id}
                                checked={marcada}
                                onChange={() => alternarTarefa(indice, tIdx)}
                              />
                              <label htmlFor={id}>
                                <span className="pt-day">{dia}</span>
                                {texto}
                              </label>
                            </li>
                          )
                        })}
                      </ul>

                      {semana.resources.length > 0 && (
                        <div className="pt-resources">
                          <div className="pt-res-label">Recursos</div>
                          <div className="pt-res-list">
                            {semana.resources.map(([label, url]) => (
                              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                {label} ↗
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ))}

      <div className="pt-disclaimer">
        Conteúdo educacional de uso pessoal, não constitui recomendação de investimento. Operações com contratos
        futuros, opções e estruturas derivativas envolvem risco de perda substancial, inclusive superior ao
        capital investido, e devem ser praticadas em ambiente simulado (Profit Training / conta demo) até que as
        regras de gestão de risco estejam validadas. O progresso das tarefas concluídas fica salvo na sua conta e
        volta a aparecer em qualquer sessão ou dispositivo.
      </div>
    </div>
  )
}
