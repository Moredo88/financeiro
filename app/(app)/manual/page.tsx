import Link from 'next/link'
import {
  LayoutDashboard, Receipt, Settings, Sparkles, Users, Landmark,
  SlidersHorizontal, ArrowLeftRight, CalendarCheck, PieChart, BarChart3,
  Eye, Download, ArrowUpDown, Calculator, AlertTriangle, Lightbulb,
} from 'lucide-react'

export const metadata = { title: 'Manual do Usuario' }

const SUMARIO = [
  { id: 'visao-geral', titulo: 'Visao geral' },
  { id: 'em-todas-as-telas', titulo: 'Recursos que valem em todas as telas' },
  { id: 'rotina-mensal', titulo: 'A rotina mensal (o essencial)' },
  { id: 'lancamentos', titulo: 'Lancamentos' },
  { id: 'dashboard', titulo: 'Dashboard' },
  { id: 'configuracoes', titulo: 'Configuracoes' },
  { id: 'ativos', titulo: 'Ativos' },
  { id: 'parametros', titulo: 'Parametros' },
  { id: 'movimentacoes', titulo: 'Movimentacoes' },
  { id: 'saldos-mensais', titulo: 'Saldos Mensais' },
  { id: 'dashboard-estrategia', titulo: 'Dashboard Estrategia' },
  { id: 'dashboard-gestao', titulo: 'Dashboard Gestao' },
  { id: 'assistente', titulo: 'Assistente IA' },
  { id: 'usuarios', titulo: 'Usuarios (admin)' },
  { id: 'como-o-rendimento-e-calculado', titulo: 'Como o rendimento e calculado' },
  { id: 'quando-algo-nao-bate', titulo: 'Quando algo nao bate' },
]

export default function ManualPage() {
  return (
    <div className="max-w-4xl space-y-6 pb-12">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-2xl font-bold text-slate-900">Manual do Usuario</h1>
        <p className="mt-2 text-slate-600">
          Como usar o Conta Corrente: o que cada tela faz, em que ordem preencher e como os numeros
          sao calculados. Comece pela <A href="#rotina-mensal">rotina mensal</A> — e o que voce vai
          repetir todo mes.
        </p>

        <nav className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Sumario</p>
          <ol className="grid gap-x-6 gap-y-1 sm:grid-cols-2 text-sm">
            {SUMARIO.map((s, i) => (
              <li key={s.id} className="flex gap-2">
                <span className="text-slate-300 tabular-nums">{String(i + 1).padStart(2, '0')}</span>
                <A href={`#${s.id}`}>{s.titulo}</A>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* ---------------------------------------------------------------- */}
      <Secao id="visao-geral" titulo="Visao geral">
        <P>
          O sistema tem duas metades independentes, que aparecem separadas no menu lateral.
        </P>
        <div className="grid gap-4 sm:grid-cols-2">
          <Bloco titulo="Conta corrente" icone={Receipt}>
            O dinheiro do dia a dia: o que entrou e o que saiu. Voce lanca em{' '}
            <strong>Lancamentos</strong>, categoriza pelos cadastros de <strong>Configuracoes</strong>{' '}
            e acompanha no <strong>Dashboard</strong>.
          </Bloco>
          <Bloco titulo="Investimentos" icone={Landmark}>
            A carteira: o que voce tem, quanto vale e quanto rendeu. O cadastro fica em{' '}
            <strong>Ativos</strong> e <strong>Parametros</strong>, os eventos em{' '}
            <strong>Movimentacoes</strong>, o retrato mensal em <strong>Saldos Mensais</strong> e a
            leitura nos dois dashboards.
          </Bloco>
        </div>
        <Nota>
          As duas metades nao se misturam: um aporte lancado em Movimentacoes nao vira lancamento de
          conta corrente, e vice-versa. Se voce quiser ver a saida de caixa do aporte, lance tambem em
          Lancamentos, na categoria Investimento.
        </Nota>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="em-todas-as-telas" titulo="Recursos que valem em todas as telas">
        <Lista
          itens={[
            {
              icone: Eye,
              titulo: 'Ocultar valores',
              texto: 'O botao no canto superior direito troca todo valor em dinheiro por pontinhos, inclusive nos graficos. Serve para abrir o sistema com gente por perto. A escolha fica salva no navegador.',
            },
            {
              icone: ArrowUpDown,
              titulo: 'Ordenar pela coluna',
              texto: 'Clique no titulo de qualquer coluna para ordenar. Clicar de novo inverte. Vazios vao sempre para o fim, nas duas direcoes.',
            },
            {
              icone: Download,
              titulo: 'Exportar Excel',
              texto: 'Gera um .xlsx com exatamente o que esta na tela — os filtros aplicados valem para o arquivo.',
            },
          ]}
        />
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="rotina-mensal" titulo="A rotina mensal (o essencial)">
        <P>
          Se voce so fizer isto todo mes, o historico e os dashboards ficam corretos:
        </P>
        <Passos
          passos={[
            <>
              <strong>No primeiro dia util do mes</strong>, exporte a posicao na B3: Portal do
              Investidor {'->'} Extratos {'->'} Posicao {'->'} Exportar para Excel.
            </>,
            <>
              Abra <strong>Saldos Mensais</strong> {'->'} <em>Novo fechamento</em> e escolha o mes. A
              data de posicao ja vem calculada.
            </>,
            <>
              <em>Importar extrato B3</em>, confira a tela de casamento e aplique.
            </>,
            <>
              Lance os proventos do mes em <strong>Movimentacoes</strong> (Dividendo, JCP, Rendimento,
              Cupom) e volte para clicar em <em>Recalcular movimentos</em>.
            </>,
            <>
              Preencha na mao o que a B3 nao traz: previdencia, COE, CDB fora da B3, cripto, caixa.
            </>,
            <>
              <em>Salvar</em> e <em>Fechar mes</em>.
            </>,
          ]}
        />
        <Nota>
          O extrato da B3 nunca fecha o patrimonio inteiro — ele cobre acoes, BDR, ETF, fundos,
          Tesouro Direto e renda fixa registrada. O resto e sempre manual. Por isso o painel de
          cobertura existe: ele diz quantos ativos ainda estao sem saldo.
        </Nota>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="lancamentos" titulo="Lancamentos" icone={Receipt}>
        <P>
          Toda entrada e saida da conta corrente. Valor positivo e entrada, negativo e saida.
        </P>
        <Campos
          campos={[
            ['Data / Valor', 'Obrigatorios.'],
            ['Descricao', 'Texto livre; e por aqui que a busca procura.'],
            ['Categoria', 'Para que foi o dinheiro (Mercado, Moradia, Investimento...).'],
            ['Classe', 'De quem e o gasto (Comum, Sergio, Marcia...).'],
            ['Conta', 'Onde o dinheiro passou (BTG-C, INTER, VISA...).'],
            ['Frequencia', 'Mensal, Pontual, Anual... Alem de classificar, comanda a recorrencia.'],
            ['Status', 'Realizado (ja aconteceu) ou Previsto (ainda vai acontecer). Os dashboards deixam voce filtrar por um ou por outro.'],
            ['Parcial / Reembolso', 'Campos livres para marcar pagamento parcial e valor a receber de volta.'],
            ['Observacao', 'Texto longo, so para consulta.'],
          ]}
        />
        <SubTitulo>Lancamento recorrente</SubTitulo>
        <P>
          Marque <em>Recorrente</em> e informe a data-fim: o sistema cria uma copia por periodo ate
          essa data, no intervalo da Frequencia escolhida (Diario, Semanal, Mensal, Trimestral,
          Semestral, Anual). Sao lancamentos independentes — editar ou excluir um nao mexe nos outros.
        </P>
        <Aviso>
          Confira a data-fim antes de salvar. Uma recorrencia diaria de dez anos gera milhares de
          linhas, e desfazer e um a um.
        </Aviso>
        <P>
          A lista vem paginada de 25 em 25, com filtros por periodo, categoria, classe, conta e
          status.
        </P>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="dashboard" titulo="Dashboard" icone={LayoutDashboard}>
        <P>
          A leitura da conta corrente: totais do periodo, evolucao mes a mes, distribuicao por
          categoria, classe e conta. Os filtros do topo valem para todos os graficos ao mesmo tempo.
        </P>
        <Nota>
          Filtre por <strong>Status = Realizado</strong> para ver so o que ja aconteceu. Sem esse
          filtro, os previstos entram nos totais e o mes corrente parece maior do que e.
        </Nota>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="configuracoes" titulo="Configuracoes" icone={Settings}>
        <P>
          As quatro listas que alimentam os campos de Lancamentos: <strong>Categorias</strong>,{' '}
          <strong>Classes</strong>, <strong>Contas</strong> e <strong>Frequencias</strong>.
        </P>
        <P>
          Itens nao sao excluidos, sao <strong>inativados</strong> pelo botao de alternancia. O item
          inativo some das listas de escolha, mas os lancamentos antigos que o usam continuam
          intactos. E o jeito certo de aposentar uma conta que voce encerrou.
        </P>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="ativos" titulo="Ativos" icone={Landmark}>
        <P>
          O cadastro de cada papel da carteira: o <em>o que e</em>. A tela separa{' '}
          <strong>Renda Variavel</strong> de <strong>Demais Investimentos</strong>, porque as colunas
          uteis sao diferentes — a renda fixa mostra Taxa e Indexador, a variavel nao.
        </P>
        <Campos
          campos={[
            ['Ticker', 'Codigo do papel (ANIM3). Em renda fixa, use o codigo do produto.'],
            ['Nome', 'Nome por extenso, usado nas listas e nos relatorios.'],
            ['Classe', 'RENDA VAR, RENDA FIXA, TESOURO DIRETO, FUNDOS INVEST., PREVIDENCIA, COE, CAIXA.'],
            ['Categoria', 'O detalhe dentro da classe: ACOES, FII, ETF, CDB, CRI, PGBL...'],
            ['Segmento', 'Setor economico, usado no Dashboard Estrategia.'],
            ['Banco/Corretora', 'Onde o papel esta custodiado.'],
            ['Casa de analise', 'Quem recomendou.'],
            ['Status', 'Ativo, Inativo ou Liquidado. So os Ativos entram na grade de Saldos Mensais.'],
            ['Taxa e Vencimento', 'Renda fixa: taxa contratada e data de vencimento.'],
          ]}
        />
        <Aviso>
          O mesmo ticker pode ser cadastrado mais de uma vez, uma por corretora — B3SA3 no BTG e B3SA3
          na XP sao dois ativos, cada um com sua posicao e seu preco medio. E por isso que o import da
          B3 casa por <strong>ticker + instituicao</strong>: se a corretora do cadastro estiver
          errada, a linha do extrato cai como ambigua.
        </Aviso>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="parametros" titulo="Parametros" icone={SlidersHorizontal}>
        <P>
          Duas coisas moram aqui. A primeira secao, <strong>Parametros por Ativo</strong>, guarda a
          sua estrategia para cada papel: carteira, estrategia, alocacao-alvo, aporte planejado,
          recomendacao atual, liquidez, preco-teto, tags de exposicao e, na renda fixa, indexador,
          amortizacao, juros e datas.
        </P>
        <P>
          As outras oito secoes sao os cadastros que abastecem os campos de escolha: Classes de Ativo,
          Categorias de Ativo, Segmentos, Bancos/Corretoras, Casas de Analise, Carteiras, Estrategias
          e Tags de Exposicao.
        </P>
        <Nota>
          <strong>Alocacao-alvo</strong> e <strong>aporte planejado</strong> so servem para alguma
          coisa se estiverem preenchidos: sao eles que alimentam os graficos de gap e de planejado vs.
          realizado no Dashboard Estrategia.
        </Nota>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="movimentacoes" titulo="Movimentacoes" icone={ArrowLeftRight}>
        <P>
          Os eventos de cada ativo ao longo do tempo. E daqui que saem quantidade, preco medio e
          proventos.
        </P>
        <Campos
          campos={[
            ['Compra / Venda', 'Somam e subtraem quantidade. O preco medio sai das compras.'],
            ['Dividendo / JCP / Rendimento / Cupom', 'Proventos recebidos. Nao mexem na quantidade.'],
            ['Amortizacao', 'Devolucao de principal, tipica de CRI, CRA e debenture.'],
            ['Bonificacao / Subscricao', 'Aumentam a quantidade.'],
          ]}
        />
        <P>
          Em cada lancamento voce informa data, instituicao, quantidade, preco unitario e valor
          liquido. Para provento, o que importa e o <strong>valor liquido</strong>.
        </P>
        <Nota>
          Lance os proventos <strong>antes</strong> de clicar em <em>Recalcular movimentos</em> no
          fechamento do mes. E daqui que aquele botao le os numeros.
        </Nota>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="saldos-mensais" titulo="Saldos Mensais" icone={CalendarCheck} destaque>
        <P>
          O coracao do historico. Aqui voce congela, uma vez por mes, quanto cada ativo valia — e e
          desse retrato que sai toda a serie de patrimonio e de rendimento.
        </P>
        <Nota>
          Por que essa tela precisa existir: a cotacao e o saldo que aparecem no cadastro sao{' '}
          <strong>sobrescritos</strong> a cada atualizacao. Sem o fechamento, o sistema so saberia
          dizer quanto a carteira vale hoje, e nunca quanto valia em marco.
        </Nota>

        <SubTitulo>1. Abrir a competencia</SubTitulo>
        <P>
          <em>Novo fechamento</em> {'->'} escolha o mes. O sistema calcula o{' '}
          <strong>primeiro dia util</strong>, pulando fim de semana e feriado nacional (inclusive os
          moveis, como Carnaval e Corpus Christi). Se voce importar com atraso, pode corrigir a data
          de posicao para o dia real do extrato.
        </P>

        <SubTitulo>2. Importar o extrato da B3</SubTitulo>
        <P>
          <em>Importar extrato B3</em> e escolha o .xlsx. Abre a tela de conferencia, e{' '}
          <strong>nada e gravado ate voce confirmar</strong>. Cada linha aparece com uma situacao:
        </P>
        <Campos
          campos={[
            ['Casado', 'Ticker e corretora bateram com um cadastro. Nada a fazer.'],
            ['Corretora difere', 'So existe um cadastro com esse ticker, mas a instituicao do extrato e outra. Ele e usado assim mesmo, e o aviso mostra as duas.'],
            ['Ambiguo', 'Mais de um cadastro possivel. Escolha qual no seletor da linha.'],
            ['Sem par', 'Nenhum ativo cadastrado corresponde. Cadastre em Ativos, ou escolha o cadastro certo na hora.'],
          ]}
        />
        <P>
          <em>Aplicar na grade</em> leva os valores para a tabela, marcados como origem{' '}
          <strong>B3</strong>. Linhas deixadas de fora simplesmente nao entram.
        </P>

        <SubTitulo>3. Recalcular movimentos</SubTitulo>
        <P>
          Preenche aportes, resgates e proventos de cada ativo somando as movimentacoes lancadas{' '}
          <strong>entre a data do fechamento anterior e a deste</strong>. Sao esses tres numeros que
          separam rendimento de dinheiro novo. Voce pode ajustar qualquer celula na mao depois.
        </P>

        <SubTitulo>4. Completar o que falta</SubTitulo>
        <P>
          As linhas sem saldo ficam com fundo amarelo e listadas no alerta do topo.{' '}
          <em>Repetir mes anterior</em> copia o saldo do fechamento anterior{' '}
          <strong>somente para o que ainda esta vazio</strong> — nao sobrescreve o que veio da B3 nem
          o que voce digitou. Essas linhas ficam marcadas como <strong>Repetido</strong>, para voce
          lembrar que aquele numero nao foi conferido.
        </P>

        <SubTitulo>5. Salvar e fechar</SubTitulo>
        <P>
          <em>Salvar</em> grava. <em>Fechar mes</em> trava a competencia: nenhum saldo pode ser
          alterado, inserido ou apagado enquanto ela estiver fechada. Para corrigir depois, use{' '}
          <em>Reabrir</em>.
        </P>
        <Aviso>
          Salve antes de fechar ou reabrir. Mudar o status recarrega a grade do banco, e edicao nao
          salva se perde — a tela avisa e bloqueia se houver pendencia.
        </Aviso>

        <SubTitulo>Digitando valores</SubTitulo>
        <P>
          Os campos aceitam <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">1234,56</code> e{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">1234.56</code>. Nao use ponto de
          milhar sem virgula decimal: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">1.000</code>{' '}
          sozinho e lido como 1, porque ponto sem virgula e separador decimal.
        </P>

        <SubTitulo>Meses antigos</SubTitulo>
        <P>
          A tela aceita qualquer competencia, inclusive passada. Se voce tem extratos B3 guardados,
          crie o fechamento do mes antigo e importe normalmente — o historico se monta de tras para
          frente.
        </P>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="dashboard-estrategia" titulo="Dashboard Estrategia" icone={PieChart}>
        <P>
          Responde <em>como a carteira esta distribuida</em>: por estrategia, classe, segmento, casa
          de analise e tag de exposicao, mais o ranking de recomendacoes.
        </P>
        <P>
          Dois graficos comparam o plano com a realidade:{' '}
          <strong>Alocacao-alvo vs. Real</strong> mostra os maiores desvios, e{' '}
          <strong>Aportes: Planejado vs. Realizado</strong> confronta o aporte planejado com o
          efetivamente feito. Os dois dependem dos campos preenchidos em Parametros.
        </P>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="dashboard-gestao" titulo="Dashboard Gestao" icone={BarChart3}>
        <P>
          Responde <em>quanto a carteira vale e quanto rendeu</em>. Tem duas camadas.
        </P>
        <SubTitulo>Hoje</SubTitulo>
        <P>
          Patrimonio, rentabilidade e proventos calculados agora, a partir das movimentacoes e da
          cotacao mais recente. Inclui posicao por ativo, distribuicao por classe e corretora, top 5,
          vencimentos de renda fixa e alertas de concentracao acima de 20%.
        </P>
        <P>
          O botao <em>Atualizar cotacoes</em> busca o preco dos ativos de renda variavel. Renda fixa
          nao tem cotacao de mercado: o valor dela vem do ultimo fechamento mensal.
        </P>
        <SubTitulo>Historico</SubTitulo>
        <P>
          So aparece depois do primeiro fechamento gravado. Traz patrimonio do ultimo mes, rendimento
          do mes e dos ultimos 12 meses, o grafico de <strong>Evolucao do Patrimonio</strong> (com o
          rendimento acumulado sobreposto), <strong>Rendimento por Mes</strong> em barras e a tabela
          de fechamentos.
        </P>
        <Aviso>
          Nao confunda com o grafico <strong>Aportes acumulados</strong>. Ele mostra so compras menos
          vendas — dinheiro que voce colocou, sem nenhum rendimento dentro. Patrimonio de verdade e o
          da Evolucao do Patrimonio.
        </Aviso>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="assistente" titulo="Assistente IA" icone={Sparkles}>
        <P>
          Perguntas em portugues sobre os seus proprios dados: ele consulta lancamentos e
          investimentos e responde com numeros e tabelas. Por exemplo,{' '}
          <em>&quot;quanto gastei por categoria nos ultimos 12 meses?&quot;</em> ou{' '}
          <em>&quot;quanto recebi de proventos ate agora?&quot;</em>.
        </P>
        <Nota>
          Ele le o que esta gravado. Se um mes ainda nao foi fechado ou um provento nao foi lancado, a
          resposta reflete essa falta — nao e erro do assistente.
        </Nota>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="usuarios" titulo="Usuarios (admin)" icone={Users}>
        <P>
          Visivel so para quem tem papel <strong>admin</strong>. Permite criar usuario com e-mail e
          senha, trocar o papel entre admin e usuario, redefinir senha e excluir. O papel usuario
          enxerga tudo, menos esta tela.
        </P>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="como-o-rendimento-e-calculado" titulo="Como o rendimento e calculado" icone={Calculator}>
        <P>Para cada ativo, em cada mes:</P>
        <div className="rounded-lg bg-slate-900 px-4 py-3 font-mono text-sm text-slate-100 overflow-x-auto">
          rendimento = saldo − saldo anterior − aportes + resgates + proventos
        </div>
        <P>
          Os aportes entram subtraindo e os resgates somando de volta justamente para que{' '}
          <strong>dinheiro novo nao vire lucro</strong>. Se voce tinha R$ 1.000, aportou R$ 10.000 e o
          saldo virou R$ 11.000, o rendimento e zero — nao R$ 10.000.
        </P>
        <P>
          Os proventos entram somando porque saem do ativo: o saldo cai quando o dividendo e pago, mas
          o dinheiro nao sumiu.
        </P>
        <SubTitulo>Quando o rendimento fica em branco</SubTitulo>
        <P>
          No primeiro retrato de um ativo, sem mes anterior e sem aporte declarado, nao existe base de
          comparacao — o campo mostra um traco e o mes conta como <em>nao apurado</em>. E o que
          acontece no seu primeiro fechamento inteiro. A apuracao comeca no mes seguinte.
        </P>
        <SubTitulo>Rentabilidade %</SubTitulo>
        <P>
          Na tabela de fechamentos, a rentabilidade e o rendimento dividido pela base do mes (saldo
          anterior + aportes − resgates).
        </P>
      </Secao>

      {/* ---------------------------------------------------------------- */}
      <Secao id="quando-algo-nao-bate" titulo="Quando algo nao bate" icone={AlertTriangle}>
        <Faq
          itens={[
            {
              p: 'O Dashboard Gestao nao mostra o bloco de historico.',
              r: 'Nenhum fechamento foi gravado ainda. Crie o primeiro em Saldos Mensais.',
            },
            {
              p: 'O rendimento do mes deu um valor absurdo, do tamanho de um aporte.',
              r: 'Os aportes do periodo estao zerados. Abra o fechamento e clique em Recalcular movimentos — ou digite os valores na mao, se a compra nao estiver lancada em Movimentacoes.',
            },
            {
              p: 'Um ativo da B3 caiu como "Sem par".',
              r: 'Nao existe cadastro com aquele ticker, ou o nome do produto nao bate. Cadastre em Ativos e importe de novo, ou escolha o cadastro certo no seletor da propria linha.',
            },
            {
              p: 'Um ativo caiu como "Ambiguo".',
              r: 'O mesmo ticker esta cadastrado em mais de uma corretora e a instituicao do extrato nao decidiu qual. Escolha na linha.',
            },
            {
              p: 'Um papel de renda fixa aparece valendo exatamente o preco de compra.',
              r: 'Ele nunca teve saldo informado num fechamento. Sem isso o sistema usa o custo, e o rendimento fica zero. Preencha o saldo dele no fechamento do mes.',
            },
            {
              p: 'Nao consigo editar os saldos de um mes.',
              r: 'A competencia esta fechada. Clique em Reabrir.',
            },
            {
              p: 'Digitei um valor e ele virou outro ao salvar.',
              r: 'Provavelmente foi ponto de milhar: 1.000 sem virgula e lido como 1. Digite 1000 ou 1.000,00.',
            },
            {
              p: 'O total do mes parece grande demais no Dashboard.',
              r: 'Lancamentos com status Previsto estao entrando. Filtre por Realizado.',
            },
          ]}
        />
      </Secao>

      <div className="text-center">
        <Link href="/saldos" className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline">
          Ir para Saldos Mensais {'->'}
        </Link>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Blocos de montagem do manual                                        */
/* ------------------------------------------------------------------ */

function Secao({ id, titulo, icone: Icone, destaque, children }: {
  id: string
  titulo: string
  icone?: React.ElementType
  destaque?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-6 rounded-xl border bg-white p-6 shadow-sm ${
        destaque ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
      }`}
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
        {Icone && <Icone className={`h-5 w-5 ${destaque ? 'text-blue-600' : 'text-slate-400'}`} />}
        {titulo}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  )
}

function SubTitulo({ children }: { children: React.ReactNode }) {
  return <h3 className="pt-2 text-sm font-semibold text-slate-900">{children}</h3>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-slate-600">{children}</p>
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} className="text-blue-600 hover:text-blue-700 hover:underline">
      {children}
    </a>
  )
}

function Nota({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="leading-relaxed">{children}</div>
    </div>
  )
}

function Bloco({ titulo, icone: Icone, children }: {
  titulo: string
  icone: React.ElementType
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Icone className="h-4 w-4 text-slate-400" />
        {titulo}
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{children}</p>
    </div>
  )
}

function Lista({ itens }: { itens: { icone: React.ElementType; titulo: string; texto: string }[] }) {
  return (
    <div className="space-y-3">
      {itens.map((i) => (
        <div key={i.titulo} className="flex gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <i.icone className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">{i.titulo}</p>
            <p className="text-sm leading-relaxed text-slate-600">{i.texto}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function Passos({ passos }: { passos: React.ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {passos.map((p, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm leading-relaxed text-slate-600">{p}</span>
        </li>
      ))}
    </ol>
  )
}

function Campos({ campos }: { campos: [string, string][] }) {
  return (
    <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
      {campos.map(([nome, texto]) => (
        <div key={nome} className="grid gap-1 px-4 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-4">
          <dt className="text-sm font-medium text-slate-900">{nome}</dt>
          <dd className="text-sm leading-relaxed text-slate-600">{texto}</dd>
        </div>
      ))}
    </dl>
  )
}

function Faq({ itens }: { itens: { p: string; r: string }[] }) {
  return (
    <div className="space-y-3">
      {itens.map((i) => (
        <div key={i.p} className="rounded-lg border border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">{i.p}</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{i.r}</p>
        </div>
      ))}
    </div>
  )
}
