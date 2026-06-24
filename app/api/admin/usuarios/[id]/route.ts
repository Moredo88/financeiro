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
  const { role } = await request.json()
  const supabaseAdmin = createAdminClient()

  await supabaseAdmin
    .from('user_roles')
    .upsert({ user_id: id, role }, { onConflict: 'user_id' })

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

  await supabaseAdmin.from('user_roles').delete().eq('user_id', id)
  await supabaseAdmin.auth.admin.deleteUser(id)

  return Response.json({ success: true })
}
