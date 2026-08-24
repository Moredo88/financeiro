'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Eye, EyeOff, Menu, Plus } from 'lucide-react'
import { useValores } from '@/components/ValoresProvider'
import { useSidebar } from '@/components/layout/SidebarProvider'

// Mesma ordem e mesmos nomes do Sidebar, para o cabecalho bater com o menu.
const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/anotacoes': 'Anotacoes',
  '/acoes': 'Acoes',
  '/lancamentos': 'Lancamentos',
  '/assistente': 'Assistente IA',
  '/configuracoes': 'Configuracoes',
  '/ativos': 'Ativos',
  '/parametros': 'Parametros',
  '/movimentacoes': 'Movimentacoes',
  '/saldos': 'Saldos Mensais',
  '/estrategia': 'Dashboard Estrategia',
  '/gestao': 'Dashboard Gestao',
  '/admin/usuarios': 'Usuarios',
  '/manual': 'Manual do Usuario',
}

export default function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const title = titles[pathname] ?? 'Conta Corrente'
  const { oculto, alternar } = useValores()
  const { openMobile } = useSidebar()

  return (
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={openMobile}
          aria-label="Abrir menu"
          className="-ml-1 inline-flex items-center justify-center rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {/* Disponiveis em qualquer tela: levam para a tela dona do dado com
            a criacao ja aberta, em vez de duplicar a logica de salvar aqui. */}
        <button
          type="button"
          onClick={() => router.push('/acoes?novo=1')}
          title="Nova Acao"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Acao</span>
        </button>
        <button
          type="button"
          onClick={() => router.push('/anotacoes?novo=1')}
          title="Nova Anotacao"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Anotacao</span>
        </button>
        <button
          type="button"
          onClick={alternar}
          aria-pressed={oculto}
          title={oculto ? 'Mostrar valores' : 'Ocultar valores'}
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          {oculto ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span className="hidden sm:inline">{oculto ? 'Mostrar valores' : 'Ocultar valores'}</span>
        </button>
      </div>
    </header>
  )
}
