import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Diferente de /api/admin/usuarios, aqui nao ha checagem de role: qualquer
// usuario autenticado pode listar quem existe, para escolher Responsavel ou
// Solicitante numa acao. Email vive em auth.users, fora do alcance de RLS
// comum, entao a leitura passa pela service role no servidor — o cliente so
// recebe id e email, nunca a chave.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: { users } } = await admin.auth.admin.listUsers()

  const result = (users ?? [])
    .map((u) => ({ id: u.id, email: u.email ?? '' }))
    .sort((a, b) => a.email.localeCompare(b.email, 'pt-BR', { sensitivity: 'base' }))

  return Response.json({ users: result })
}
