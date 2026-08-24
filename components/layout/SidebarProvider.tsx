'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const STORAGE_KEY = 'ccor:menu-recolhido'
const GRUPOS_KEY = 'ccor:grupos-recolhidos'

interface SidebarContextValue {
  /** Menu reduzido a icones, no desktop. */
  collapsed: boolean
  toggleCollapsed: () => void
  /** Grupo aberto ou recolhido, por id. */
  isGroupOpen: (id: string) => boolean
  toggleGroup: (id: string) => void
  /** Painel sobreposto, em telas pequenas. */
  mobileOpen: boolean
  openMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Comeca expandido para o HTML do servidor bater com o do cliente; as
  // preferencias salvas sao aplicadas logo apos a montagem.
  const [collapsed, setCollapsed] = useState(false)
  const [gruposFechados, setGruposFechados] = useState<string[]>([])
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1')
    const salvos = window.localStorage.getItem(GRUPOS_KEY)
    if (salvos) setGruposFechados(salvos.split(',').filter(Boolean))
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const proximo = !prev
      window.localStorage.setItem(STORAGE_KEY, proximo ? '1' : '0')
      return proximo
    })
  }, [])

  // Guardamos quem esta FECHADO: assim um grupo novo nasce aberto, sem
  // precisar migrar a preferencia de quem ja usa o sistema.
  const isGroupOpen = useCallback((id: string) => !gruposFechados.includes(id), [gruposFechados])

  const toggleGroup = useCallback((id: string) => {
    setGruposFechados((prev) => {
      const proximo = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
      window.localStorage.setItem(GRUPOS_KEY, proximo.join(','))
      return proximo
    })
  }, [])

  const openMobile = useCallback(() => setMobileOpen(true), [])
  const closeMobile = useCallback(() => setMobileOpen(false), [])

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
      value={{
        collapsed,
        toggleCollapsed,
        isGroupOpen,
        toggleGroup,
        mobileOpen,
        openMobile,
        closeMobile,
      }}
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
