import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { TOOLS, executarFerramenta } from '@/lib/assistente/tools'

// Modelo intermediario da familia Claude (Opus = mais capaz, Sonnet = intermediario, Haiku = mais rapido).
const MODEL = 'claude-sonnet-5'
const MAX_ITERACOES = 8
const MAX_MENSAGENS_HISTORICO = 20

const SYSTEM_PROMPT = `Voce e o assistente do "Conta Corrente", um sistema pessoal de controle financeiro e de investimentos.

O sistema tem duas areas:
- Lancamentos: despesas e receitas, classificados por Categoria, Classe (a pessoa/entidade a que se refere), Conta (banco ou cartao) e Frequencia. Cada lancamento tem status Realizado ou Previsto.
- Investimentos: ativos cadastrados (acoes, FIIs, renda fixa, etc.) e suas movimentacoes (compras, vendas, dividendos, JCP, rendimentos, cupons). A posicao atual e sempre derivada da soma das movimentacoes.

Use as ferramentas disponiveis para consultar os dados reais antes de responder qualquer pergunta sobre numeros. Nunca invente valores nem estime a partir do que voce imagina que os dados sejam. Se uma consulta voltar vazia, diga isso claramente.

Quando for filtrar por categoria, classe ou conta, chame listar_opcoes_cadastro primeiro para usar o nome exato cadastrado.

Como responder:
- Escreva em portugues do Brasil, de forma direta e concisa.
- Valores em reais no formato R$ 1.234,56.
- Comece pela resposta e so depois traga o detalhamento. Use tabelas apenas quando comparar varios itens.
- Ao citar um total, diga o periodo e os filtros que ele considera.

Limite importante: voce pode analisar e explicar os dados que o usuario ja tem, mas nao faz recomendacoes personalizadas de investimento — nao diga a ele o que comprar, vender ou manter, nem projete retornos futuros. Se ele pedir isso, explique que voce nao e um consultor de investimentos licenciado, e ofereca no lugar a analise dos dados que ele registrou (concentracao, rentabilidade realizada, proventos recebidos, alocacao versus alvo).`

interface RequestBody {
  messages?: { role: 'user' | 'assistant'; content: string }[]
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Nao autenticado' }, { status: 401 })

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY nao configurada no servidor.' },
      { status: 500 }
    )
  }

  const body: RequestBody = await request.json()
  const historico = (body.messages ?? []).slice(-MAX_MENSAGENS_HISTORICO)
  if (historico.length === 0) {
    return Response.json({ error: 'Nenhuma mensagem enviada.' }, { status: 400 })
  }

  const client = new Anthropic()
  const messages: Anthropic.MessageParam[] = historico.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  try {
    for (let i = 0; i < MAX_ITERACOES; i++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        output_config: { effort: 'medium' },
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      })

      if (response.stop_reason === 'refusal') {
        return Response.json({
          reply: 'Nao consigo responder essa solicitacao. Tente reformular a pergunta.',
        })
      }

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      if (toolUses.length === 0) {
        const texto = response.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim()
        return Response.json({ reply: texto || 'Nao consegui gerar uma resposta.' })
      }

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const toolUse of toolUses) {
        try {
          const resultado = await executarFerramenta(supabase, toolUse.name, toolUse.input)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: JSON.stringify(resultado),
          })
        } catch (e) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Erro ao consultar os dados: ${e instanceof Error ? e.message : 'desconhecido'}`,
            is_error: true,
          })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }

    return Response.json({
      reply: 'A consulta ficou complexa demais e foi interrompida. Tente uma pergunta mais especifica.',
    })
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({ error: 'Limite de uso atingido. Tente novamente em instantes.' }, { status: 429 })
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: 'Chave da API Anthropic invalida.' }, { status: 500 })
    }
    console.error('Erro no assistente:', e)
    return Response.json({ error: 'Falha ao consultar o assistente.' }, { status: 500 })
  }
}
