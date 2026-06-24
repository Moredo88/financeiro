import { createClient } from '@/lib/supabase/server'
import { getUserRole } from '@/lib/auth/permissions'
import { redirect } from 'next/navigation'
import AppShell from './AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = await getUserRole(user.id)

  return (
    <AppShell userRole={role} userEmail={user.email ?? ''}>
      {children}
    </AppShell>
  )
}
