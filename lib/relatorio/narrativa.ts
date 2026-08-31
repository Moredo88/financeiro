import Anthropic from '@anthropic-ai/sdk'
import type { RelatorioData, RelatorioNarrativa } from './types'

const MODEL = 'claude-opus-5'
const MAX_TOKENS = 24_000

const PRIORIDADE = { type: 'string', enum: ['alta', 'media', 'baixa'] } as const
const ITEM_PLANO = {
  type: 'object',
  properties: { prioridade: PRIORIDADE, texto: { type: 'string' } },
  required: ['prioridade', 'texto'],
} as const

const SCHEMA_NARRATIVA = {
  type: 'object',
  properties: {
    resumoExecutivo: {
      type: 'object',
      properties: {
        diagnostico: { type: 'string', description: '5 a 10 linhas sobre a situação geral da carteira.' },
        pontoPositivo: { type: 'string' },
        principalRisco: { type: 'string' },
        principalOportunidade: { type: 'string' },
        acaoPrioritaria: { type: 'string' },
      },
      required: ['diagnostico', 'pontoPositivo', 'principalRisco', 'principalOportunidade', 'acaoPrioritaria'],
    },
    diagnosticoGeral: { type: 'string' },
    analiseDiversificacao: { type: 'string' },
    analiseRisco: { type: 'string' },
    analiseRendaFixa: {
      type: 'string',
      description:
        'Comente os vereditos já calculados em data.posicoes[].rendaFixaVeredito — explique o "porquê", não recalcule números.',
    },
    analiseAcoes: { type: 'string' },
    analiseFiis: { type: 'string' },
    analiseInternacional: { type: 'string' },
    analiseEtfs: { type: 'string' },
    performanceBenchmarks: { type: 'string' },
    pontosFortes: { type: 'array', items: { type: 'string' } },
    pontosAtencao: { type: 'array', items: { type: 'string' } },
    oportunidades: { type: 'array', items: { type: 'string' } },
    carteiraAlvoComentario: { type: 'string' },
    planoRebalanceamento: { type: 'string' },
    planoAcao: {
      type: 'object',
      properties: {
        dias30: { type: 'array', items: ITEM_PLANO },
        dias90: { type: 'array', items: ITEM_PLANO },
        dias180: { type: 'array', items: ITEM_PLANO },
      },
      required: ['dias30', 'dias90', 'dias180'],
    },
    top10: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          acao: { type: 'string' },
          motivo: { type: 'string' },
          impactoEsperado: { type: 'string' },
          risco: { type: 'string' },
          prazo: { type: 'string' },
          conviccao: { type: 'string', enum: ['alta', 'media', 'baixa'] },
        },
        required: ['acao', 'motivo', 'impactoEsperado', 'risco', 'prazo', 'conviccao'],
      },
      minItems: 5,
      maxItems: 10,
    },
    riscosPremissas: { type: 'array', items: { type: 'string' } },
    conclusaoExecutiva: { type: 'string' },
  },
  required: [
    'resumoExecutivo',
    'diagnosticoGeral',
    'analiseDiversificacao',
    'analiseRisco',
    'analiseRendaFixa',
    'analiseAcoes',
    'analiseFiis',
    'analiseInternacional',
    'analiseEtfs',
    'performanceBenchmarks',
    'pontosFortes',
    'pontosAtencao',
    'oportunidades',
    'carteiraAlvoComentario',
    'planoRebalanceamento',
    'planoAcao',
    'top10',
    'riscosPremissas',
    'conclusaoExecutiva',
  ],
} satisfies Anthropic.Tool.InputSchema

const SYSTEM_PROMPT = `Você é um assessor de investimentos sênior escrevendo a parte narrativa do relatório executivo mensal de uma carteira pessoal.

Perfil confirmado pelo dono da carteira: moderado, horizonte de 10+ anos, fase de acumulação (aporta e não resgata), reserva de emergência mantida fora deste sistema, concentração em real intencional (não é falta de atenção ao câmbio).

REGRA MAIS IMPORTANTE: todos os números deste relatório — posições, alocação, concentração, limiares de indiferença fiscal, veredito por papel de renda fixa, alertas de qualidade de dado — já vêm prontos no JSON que você recebe, calculados em código, testados. Você NUNCA deve recalcular, somar, comparar taxas ou inventar um número novo. Sua função é só explicar, priorizar e dar o "porquê" por trás do que os dados já mostram. Se precisar citar um número no texto, copie exatamente o valor do JSON.

Outras regras, na mesma linha do que já rege este tipo de relatório:
- Não invente dados. Se um dado necessário não estiver no JSON, diga isso explicitamente em vez de estimar.
- Não prometa rentabilidade nem trate rentabilidade passada como garantia futura.
- Diferencie fato (o que os dados mostram) de opinião (sua leitura) claramente no texto.
- Evite recomendar movimentação excessiva da carteira; priorize qualidade sobre quantidade de mudanças.
- O plano de ação de 30/90/180 dias deve ser executável e priorizado (alta/média/baixa), não uma lista genérica.
- O top 10 deve ter de 5 a 10 itens reais, ordenados por prioridade — "não alterar" é uma resposta válida quando não houver necessidade de mudança numa posição relevante.
- Escreva em português do Brasil, direto, sem jargão desnecessário, sem repetir a mesma conclusão em seções diferentes.

Responda SOMENTE chamando a ferramenta "entregar_relatorio" com o texto completo — nunca em texto livre.`

export async function gerarNarrativa(data: RelatorioData): Promise<RelatorioNarrativa> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY não configurada no servidor.')
  }

  const client = new Anthropic()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content:
          'Dados da carteira para a competência ' +
          data.competencia +
          ' (todos os números já calculados — use-os como fonte da verdade):\n\n' +
          JSON.stringify(data),
      },
    ],
    tools: [
      {
        name: 'entregar_relatorio',
        description: 'Entrega o texto completo do relatório executivo.',
        input_schema: SCHEMA_NARRATIVA,
      },
    ],
    tool_choice: { type: 'tool', name: 'entregar_relatorio' },
  })

  if (response.stop_reason === 'refusal') {
    throw new Error('A IA recusou gerar o relatório para estes dados.')
  }

  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use' && b.name === 'entregar_relatorio'
  )
  if (!toolUse) {
    throw new Error('A IA não devolveu o relatório no formato esperado.')
  }

  return toolUse.input as RelatorioNarrativa
}
