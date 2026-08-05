export interface ExportColumn<T> {
  header: string
  /** Largura aproximada da coluna em caracteres. */
  width?: number
  value: (row: T) => string | number | Date | null | undefined
}

/**
 * Gera e baixa um .xlsx com os dados informados.
 * O exceljs e carregado sob demanda para nao entrar no bundle inicial.
 */
export async function exportToExcel<T>(
  filename: string,
  sheetName: string,
  columns: ExportColumn<T>[],
  rows: T[]
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default

  const wb = new ExcelJS.Workbook()
  wb.created = new Date()
  // Nome de aba no Excel: max 31 chars e sem : \ / ? * [ ]
  const ws = wb.addWorksheet(sheetName.replace(/[:\\/?*[\]]/g, '-').slice(0, 31))

  ws.columns = columns.map((c) => ({
    header: c.header,
    key: c.header,
    width: c.width ?? 18,
  }))

  const headerRow = ws.getRow(1)
  headerRow.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
  headerRow.alignment = { vertical: 'middle' }
  headerRow.height = 20

  rows.forEach((row) => {
    const values = columns.map((c) => c.value(row) ?? '')
    const added = ws.addRow(values)
    added.font = { name: 'Arial', size: 10 }
    added.alignment = { vertical: 'top' }
  })

  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  }
  ws.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
