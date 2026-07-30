import { createClient } from '@/lib/supabase/server'
import { atualizarCotacoes } from '@/lib/investimentos/atualizarCotacoes'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await atualizarCotacoes()
  return Response.json(result, { status: result.ok ? 200 : 500 })
}
