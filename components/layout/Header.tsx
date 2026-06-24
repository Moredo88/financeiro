'use client'

import { usePathname } from 'next/navigation'

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/lancamentos': 'Lancamentos',
  '/configuracoes': 'Configuracoes',
  '/admin/usuarios': 'Usuarios',
}

export default function Header() {
  const pathname = usePathname()
  const title = titles[pathname] ?? 'Conta Corrente'

  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
    </header>
  )
}
