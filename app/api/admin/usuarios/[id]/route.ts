import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole } from '@/lib/auth/permissions'

async function checkAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const role = await getUserRole(user.id)
  if (role !== 'admin') return null
  return user
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await checkAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { role, password } = await request.json()
  const supabaseAdmin = createAdminClient()

  if (role) {
    await supabaseAdmin
      .from('user_roles')
      .upsert({ user_id: id, role }, { onConflict: 'user_id' })
  }

  if (password) {
    if (password.length < 6) {
      return Response.json({ error: 'A senha deve ter pelo menos 6 caracteres.' }, { status: 400 })
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(id, { password })
    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }
  }

  return Response.json({ success: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await checkAdmin()
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const supabaseAdmin = createAdminClient()

  const { error: erroRole } = await supabaseAdmin.from('user_roles').delete().eq('user_id', id)
  if (erroRole) {
    return Response.json({ error: erroRole.message }, { status: 400 })
  }

  // Lancamentos, ativos e movimentacoes guardam created_by apontando para
  // auth.users, entao apagar quem ja registrou algo esbarra na FK. Sem devolver
  // o erro, a tela dizia "excluido" e o usuario continuava na lista.
  const { error: erroUser } = await supabaseAdmin.auth.admin.deleteUser(id)
  if (erroUser) {
    return Response.json({ error: erroUser.message }, { status: 400 })
  }

  return Response.json({ success: true })
}
