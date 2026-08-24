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
  StickyNote,
  Kanban,
  X,
} from 'lucide-react'
import { useSidebar } from './SidebarProvider'

interface SidebarProps {
  userRole?: string
  userEmail?: string
}

type NavItem = { name: string; href: string; icon: React.ElementType; external?: boolean }
type NavGroup = { id: string; label: string; items: NavItem[]; adminOnly?: boolean }

const ANOTACOES: NavItem = { name: 'Anotacoes', href: '/anotacoes', icon: StickyNote }

const GRUPOS: NavGroup[] = [
  {
    id: 'conta-corrente',
    label: 'Conta Corrente',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
      { name: 'Lancamentos', href: '/lancamentos', icon: Receipt },
      { name: 'Assistente IA', href: '/assistente', icon: Sparkles },
      { name: 'Configuracoes', href: '/configuracoes', icon: Settings },
    ],
  },
  {
    id: 'investimentos',
    label: 'Investimentos',
    items: [
      { name: 'Ativos', href: '/ativos', icon: Landmark },
      { name: 'Parametros', href: '/parametros', icon: SlidersHorizontal },
      { name: 'Movimentacoes', href: '/movimentacoes', icon: ArrowLeftRight },
      { name: 'Saldos Mensais', href: '/saldos', icon: CalendarCheck },
      { name: 'Dashboard Estrategia', href: '/estrategia', icon: PieChart },
      { name: 'Dashboard Gestao', href: '/gestao', icon: BarChart3 },
    ],
  },
  {
    id: 'capacitacao',
    label: 'Capacitacao',
    items: [
      { name: 'Plano de Trading', href: '/plano-trading', icon: GraduationCap },
    ],
  },
  {
    id: 'administracao',
    label: 'Administracao',
    adminOnly: true,
    items: [{ name: 'Usuarios', href: '/admin/usuarios', icon: Users }],
  },
]

const linkBase =
  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900'

export default function Sidebar({ userRole, userEmail }: SidebarProps) {
  const { collapsed, toggleCollapsed, isGroupOpen, toggleGroup, mobileOpen, closeMobile } =
    useSidebar()
  const pathname = usePathname()

  // Em telas pequenas o menu e um painel sobreposto: la ele nunca fica em modo
  // icone, entao os grupos valem sempre. No desktop, o modo icone dispensa os
  // cabecalhos e mostra tudo em lista corrida.
  const modoIcone = collapsed

  function renderNavItem(item: NavItem) {
    const isActive =
      !item.external && (item.href === '/' ? pathname === '/' : pathname.startsWith(item.href))

    const inner = (
      <>
        <item.icon className="h-5 w-5 shrink-0" />
        <span className={clsx('truncate', modoIcone && 'md:hidden')}>{item.name}</span>
      </>
    )

    const className = clsx(
      linkBase,
      isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
    )
    // No modo icone o texto some, entao o nome precisa vir pelo title (tooltip
    // do proprio navegador, que nao e cortado pelo overflow da barra) e pelo
    // aria-label, para quem usa leitor de tela.
    const rotulo = modoIcone ? item.name : undefined

    if (item.external) {
      return (
        <a
          key={item.href}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          aria-label={rotulo}
          title={rotulo}
        >
          {inner}
        </a>
      )
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className={className}
        aria-label={rotulo}
        title={rotulo}
        // No painel sobreposto, navegar tem de fechar o painel: senao ele fica
        // por cima da tela que acabou de abrir.
        onClick={closeMobile}
      >
        {inner}
      </Link>
    )
  }

  function renderGroup(group: NavGroup) {
    const aberto = isGroupOpen(group.id)
    const painelId = `menu-grupo-${group.id}`

    return (
      <div key={group.id} className="pt-2 first:pt-0">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={aberto}
          aria-controls={painelId}
          className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
        >
          <ChevronRight
            aria-hidden="true"
            className={clsx(
              'h-3.5 w-3.5 shrink-0 transition-transform duration-200',
              aberto && 'rotate-90'
            )}
          />
          <span className="truncate">{group.label}</span>
        </button>

        {/* 0fr -> 1fr anima a altura sem precisar medi-la em JavaScript. */}
        <div
          id={painelId}
          inert={!aberto}
          className={clsx(
            'grid transition-[grid-template-rows] duration-200 ease-in-out',
            aberto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
          )}
        >
          <div className="overflow-hidden">
            <div className="space-y-1 pt-1">{group.items.map(renderNavItem)}</div>
          </div>
        </div>
      </div>
    )
  }

  const grupos = GRUPOS.filter((g) => !g.adminOnly || userRole === 'admin')

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
        <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-5">
          {/* No modo icone a faixa tem 32px uteis: logo + botao nao cabem, e o
              botao e o que precisa estar ao alcance. */}
          <DollarSign
            className={clsx('h-7 w-7 shrink-0 text-blue-400', modoIcone && 'md:hidden')}
          />
          <span
            className={clsx('truncate text-lg font-bold tracking-tight', modoIcone && 'md:hidden')}
          >
            Conta Corrente
          </span>

          {/* Recolher o menu inteiro: no topo, onde se procura por ele. */}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={clsx(
              'hidden cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:block',
              collapsed ? 'md:mx-auto' : 'md:ml-auto'
            )}
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </button>

          <button
            type="button"
            onClick={closeMobile}
            aria-label="Fechar menu"
            className="ml-auto cursor-pointer rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4">
          {/* Fora dos grupos, e no topo: anotacao se abre no meio de outra
              tarefa, entao precisa estar sempre no mesmo lugar, sem depender
              de qual grupo esta recolhido. */}
          <div className="mb-1">{renderNavItem(ANOTACOES)}</div>

          {modoIcone ? (
            // Modo icone: sem cabecalho para clicar, os grupos nao fazem sentido.
            <div className="hidden space-y-1 md:block">
              {grupos.flatMap((g) => g.items).map(renderNavItem)}
            </div>
          ) : null}
          <div className={clsx(modoIcone && 'md:hidden')}>{grupos.map(renderGroup)}</div>
        </nav>

        <div className="space-y-1 border-t border-slate-700 px-2 py-3">
          {/* Fora dos grupos de trabalho: e ajuda, nao mais uma tela de dado. */}
          {renderNavItem({ name: 'Acoes', href: '/acoes', icon: Kanban })}
          {renderNavItem({ name: 'Manual do Usuario', href: '/manual', icon: BookOpen })}
          {userEmail && (
            <div className={clsx('truncate px-3 py-1 text-xs text-slate-400', modoIcone && 'md:hidden')}>
              {userEmail}
            </div>
          )}
          <a
            href="/auth/signout"
            className={clsx(linkBase, 'text-slate-300 hover:bg-slate-800 hover:text-white')}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            <span className={clsx('truncate', modoIcone && 'md:hidden')}>Sair</span>
          </a>
        </div>
      </aside>
    </>
  )
}
