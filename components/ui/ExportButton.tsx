'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { Download } from 'lucide-react'

interface ExportButtonProps {
  /** Deve resolver quando o download tiver sido disparado. */
  onExport: () => Promise<void>
  disabled?: boolean
  label?: string
}

export default function ExportButton({ onExport, disabled, label = 'Exportar Excel' }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false)

  async function handleClick() {
    setExporting(true)
    try {
      await onExport()
    } catch (e) {
      console.error('Falha ao exportar', e)
      alert('Nao foi possivel gerar o arquivo. Tente novamente.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} loading={exporting} disabled={disabled}>
      <Download className="h-4 w-4" />
      {label}
    </Button>
  )
}
