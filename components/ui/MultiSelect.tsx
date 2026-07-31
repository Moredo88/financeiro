'use client'

import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ChevronDown, X } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface MultiSelectProps {
  id?: string
  label?: string
  options: Option[]
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

export default function MultiSelect({
  id,
  label,
  options,
  values,
  onChange,
  placeholder = 'Todas',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggleValue(value: string) {
    onChange(values.includes(value) ? values.filter((v) => v !== value) : [...values, value])
  }

  function clearAll(e: React.MouseEvent) {
    e.stopPropagation()
    onChange([])
  }

  const allSelected = options.length > 0 && values.length === options.length

  function toggleSelectAll() {
    onChange(allSelected ? [] : options.map((o) => o.value))
  }

  const summary =
    values.length === 0
      ? placeholder
      : values.length === 1
        ? options.find((o) => o.value === values[0])?.label ?? placeholder
        : `${values.length} selecionadas`

  return (
    <div className={clsx('flex flex-col gap-1', className)} ref={ref}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={clsx(
            'w-full flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-left bg-white cursor-pointer',
            'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
            values.length === 0 ? 'text-slate-400' : 'text-slate-900'
          )}
        >
          <span className="truncate">{summary}</span>
          <span className="flex items-center gap-1 shrink-0">
            {values.length > 0 && (
              <X
                className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600"
                onClick={clearAll}
              />
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </span>
        </button>

        {open && (
          <div className="absolute z-20 mt-1 w-full max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">Nenhuma opcao</p>
            ) : (
              <>
                <label className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300"
                  />
                  Selecionar todas
                </label>
                {options.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={values.includes(opt.value)}
                      onChange={() => toggleValue(opt.value)}
                      className="rounded border-slate-300"
                    />
                    {opt.label}
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
