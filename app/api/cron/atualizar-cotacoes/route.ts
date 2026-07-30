import { atualizarCotacoes } from '@/lib/investimentos/atualizarCotacoes'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await atualizarCotacoes()
  return Response.json(result, { status: result.ok ? 200 : 500 })
}
