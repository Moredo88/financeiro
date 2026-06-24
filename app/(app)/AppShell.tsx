'use client'

import Sidebar from '@/components/layout/Sidebar'
import Header from '@/components/layout/Header'

interface AppShellProps {
  children: React.ReactNode
  userRole: string
  userEmail: string
}

export default function AppShell({ children, userRole, userEmail }: AppShellProps) {
  return (
    <div className="flex h-full">
      <Sidebar userRole={userRole} userEmail={userEmail} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
