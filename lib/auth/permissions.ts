import { createAdminClient } from '@/lib/supabase/admin'

export async function getUserRole(userId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .single()
  return data?.role ?? 'usuario'
}
