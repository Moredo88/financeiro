'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  DollarSign,
} from 'lucide-react'

interface SidebarProps {
  userRole?: string
  userEmail?: string
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Lancamentos', href: '/lancamentos', icon: Receipt },
  { name: 'Configuracoes', href: '/configuracoes', icon: Settings },
]

const adminNavigation = [
  { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
]

export default function Sidebar({ userRole, userEmail }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  const allNav = userRole === 'admin'
    ? [...navigation, ...adminNavigation]
    : navigation

  return (
    <aside
      className={clsx(
        'flex flex-col bg-slate-900 text-slate-100 transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-700">
        <DollarSign className="h-7 w-7 text-blue-400 shrink-0" />
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight truncate">Conta Corrente</span>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {allNav.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-700 px-2 py-3 space-y-1">
        {!collapsed && userEmail && (
          <div className="px-3 py-1 text-xs text-slate-400 truncate">{userEmail}</div>
        )}
        <a
          href="/auth/signout"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </a>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5 shrink-0" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5 shrink-0" />
              <span>Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
