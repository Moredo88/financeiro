import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Conta Corrente',
  description: 'Sistema de controle financeiro',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className="h-full bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  )
}
