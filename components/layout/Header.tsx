'use client'

import { usePathname } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { useValores } from '@/components/ValoresProvider'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/lancamentos': 'Lancamentos',
  '/configuracoes': 'Configuracoes',
  '/admin/usuarios': 'Usuarios',
}

export default function Header() {
  const pathname = usePathname()
  const title = titles[pathname] ?? 'Conta Corrente'
  const { oculto, alternar } = useValores()

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <button
        type="button"
        onClick={alternar}
        aria-pressed={oculto}
        title={oculto ? 'Mostrar valores' : 'Ocultar valores'}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
      >
        {oculto ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        {oculto ? 'Mostrar valores' : 'Ocultar valores'}
      </button>
    </header>
  )
}
