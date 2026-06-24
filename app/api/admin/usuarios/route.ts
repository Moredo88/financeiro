import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserRole } from '@/lib/auth/permissions'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id)
  if (role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const { data: { users } } = await admin.auth.admin.listUsers()

  const { data: roles } = await admin.from('user_roles').select('user_id, role')
  const roleMap = new Map((roles ?? []).map((r: any) => [r.user_id, r.role]))

  const result = (users ?? []).map((u: any) => ({
    id: u.id,
    email: u.email,
    role: roleMap.get(u.id) ?? 'usuario',
    created_at: u.created_at,
  }))

  return Response.json({ users: result })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const role = await getUserRole(user.id)
  if (role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const { email, password, role: newRole } = await request.json()
  const admin = createAdminClient()

  const { data: newUser, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (error) return Response.json({ error: error.message }, { status: 400 })

  if (newUser?.user) {
    await admin.from('user_roles').insert({
      user_id: newUser.user.id,
      role: newRole ?? 'usuario',
    })
  }

  return Response.json({ success: true })
}
