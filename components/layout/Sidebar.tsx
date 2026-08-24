'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  Receipt,
  Settings,
  Sparkles,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  DollarSign,
  Landmark,
  SlidersHorizontal,
  ArrowLeftRight,
  PieChart,
  BarChart3,
  CalendarCheck,
  BookOpen,
  GraduationCap,
  X,
} from 'lucide-react'
import { useSidebar } from './SidebarProvider'

interface SidebarProps {
  userRole?: string
  userEmail?: string
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Lancamentos', href: '/lancamentos', icon: Receipt },
  { name: 'Assistente IA', href: '/assistente', icon: Sparkles },
  { name: 'Configuracoes', href: '/configuracoes', icon: Settings },
]

const investimentosNavigation = [
  { name: 'Ativos', href: '/ativos', icon: Landmark },
  { name: 'Parametros', href: '/parametros', icon: SlidersHorizontal },
  { name: 'Movimentacoes', href: '/movimentacoes', icon: ArrowLeftRight },
  { name: 'Saldos Mensais', href: '/saldos', icon: CalendarCheck },
  { name: 'Dashboard Estrategia', href: '/estrategia', icon: PieChart },
  { name: 'Dashboard Gestao', href: '/gestao', icon: BarChart3 },
]

const capacitacaoNavigation = [
  { name: 'Plano de Trading', href: '/plano-trading.html', icon: GraduationCap, external: true },
]

const adminNavigation = [
  { name: 'Usuarios', href: '/admin/usuarios', icon: Users },
]

type NavItem = { name: string; href: string; icon: React.ElementType; external?: boolean }

const linkBase =
  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'

export default function Sidebar({ userRole, userEmail }: SidebarProps) {
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar()
  const pathname = usePathname()

  function renderNavItem(item: NavItem) {
    const isActive = !item.external && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))

    const inner = (
      <>
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={clsx('truncate', collapsed && 'md:hidden')}>{item.name}</span>
        {/* Tooltip: so existe visualmente com o menu recolhido no desktop; o
            nome ja chega aos leitores de tela pelo aria-label do link. */}
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-800 px-2 py-1 text-xs font-medium text-slate-100 opacity-0 shadow-lg ring-1 ring-slate-700 transition-opacity duration-150',
            collapsed && 'md:block md:group-hover:opacity-100 md:group-focus-visible:opacity-100'
          )}
        >
          {item.name}
        </span>
      </>
    )

    const className = clsx(
      linkBase,
      isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    )
    const ariaLabel = collapsed ? item.name : undefined

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          aria-label={ariaLabel}
        >
          {inner}
        </a>
      )
    }

    return (
      <Link key={item.href} href={item.href} className={className} aria-label={ariaLabel}>
        {inner}
      </Link>
    )
  }

  function renderGroupLabel(text: string) {
    return (
      <div
        className={clsx(
          'px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-500',
          collapsed && 'md:hidden'
        )}
      >
        {text}
      </div>
    )
  }

  return (
    <>
      {/* Fundo do painel sobreposto, so em telas pequenas. */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 md:hidden"
          aria-hidden="true"
          onClick={closeMobile}
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 text-slate-100 transition-transform duration-200 ease-in-out',
          'md:static md:transition-[width] md:duration-200 md:ease-in-out',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-64'
        )}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-5">
          <DollarSign className="h-7 w-7 shrink-0 text-blue-400" />
          <span className={clsx('truncate text-lg font-bold tracking-tight', collapsed && 'md:hidden')}>
            Conta Corrente
          </span>
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Fechar menu"
            className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          {navigation.map(renderNavItem)}

          {renderGroupLabel('Investimentos')}
          {investimentosNavigation.map(renderNavItem)}

          {renderGroupLabel('Capacitacao')}
          {capacitacaoNavigation.map(renderNavItem)}

          {userRole === 'admin' && adminNavigation.map(renderNavItem)}
        </nav>

        <div className="space-y-1 border-t border-slate-700 px-2 py-3">
          {/* Fora dos grupos de trabalho: e ajuda, nao mais uma tela de dado. */}
          {renderNavItem({ name: 'Manual do Usuario', href: '/manual', icon: BookOpen })}
          {userEmail && (
            <div className={clsx('truncate px-3 py-1 text-xs text-slate-400', collapsed && 'md:hidden')}>
              {userEmail}
            </div>
          )}
          <a href="/auth/signout" className={clsx(linkBase, 'text-slate-300 hover:bg-slate-800 hover:text-white')}>
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={clsx('truncate', collapsed && 'md:hidden')}>Sair</span>
          </a>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="hidden w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 md:flex"
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
    </>
  )
}
