'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { formatCurrency } from '@/lib/utils'

const STORAGE_KEY = 'ccor:ocultar-valores'
const MASCARA = '•••••'

interface ValoresContextValue {
  oculto: boolean
  alternar: () => void
  /** Formata em BRL, ou devolve a mascara quando os valores estao ocultos. */
  moeda: (valor: number | null | undefined) => string
  /** Mascara um texto ja formatado. */
  mascarar: (texto: string) => string
}

const ValoresContext = createContext<ValoresContextValue | null>(null)

export function ValoresProvider({ children }: { children: React.ReactNode }) {
  // Comeca visivel para o HTML do servidor bater com o do cliente; o valor
  // salvo e aplicado logo apos a montagem.
  const [oculto, setOculto] = useState(false)

  useEffect(() => {
    setOculto(window.localStorage.getItem(STORAGE_KEY) === '1')
  }, [])

  const alternar = useCallback(() => {
    setOculto((prev) => {
      const proximo = !prev
      window.localStorage.setItem(STORAGE_KEY, proximo ? '1' : '0')
      return proximo
    })
  }, [])

  const moeda = useCallback(
    (valor: number | null | undefined) => {
      if (valor == null) return '-'
      return oculto ? MASCARA : formatCurrency(valor)
    },
    [oculto]
  )

  const mascarar = useCallback((texto: string) => (oculto ? MASCARA : texto), [oculto])

  return (
    <ValoresContext.Provider value={{ oculto, alternar, moeda, mascarar }}>
      {children}
    </ValoresContext.Provider>
  )
}

export function useValores() {
  const ctx = useContext(ValoresContext)
  if (!ctx) throw new Error('useValores precisa estar dentro de ValoresProvider')
  return ctx
}
