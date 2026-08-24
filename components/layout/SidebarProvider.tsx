'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const STORAGE_KEY = 'ccor:menu-recolhido'

interface SidebarContextValue {
  /** Menu reduzido a icones, no desktop. */
  collapsed: boolean
  toggleCollapsed: () => void
  /** Painel sobreposto, em telas pequenas. */
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Comeca expandido para o HTML do servidor bater com o do cliente; a
  // preferencia salva e aplicada logo apos a montagem.
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const proximo = !prev
      window.localStorage.setItem(STORAGE_KEY, proximo ? '1' : '0')
      return proximo
    })
  }, [])

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

  // Troca de tela: fecha o painel sobreposto, para nao cobrir o conteudo seguinte.
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!mobileOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen])

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, openMobile, closeMobile }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar precisa estar dentro de SidebarProvider')
  return ctx
}
