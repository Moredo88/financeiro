'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import Badge from '@/components/ui/Badge'
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'

type Tab = 'categorias' | 'classes' | 'contas' | 'frequencias'

interface CadastroItem {
  id: string
  nome: string
  ativo: boolean
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'categorias', label: 'Categorias' },
  { key: 'classes', label: 'Classes' },
  { key: 'contas', label: 'Contas' },
  { key: 'frequencias', label: 'Frequencias' },
]

export default function ConfiguracoesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('categorias')
  const [items, setItems] = useState<CadastroItem[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<CadastroItem | null>(null)
  const [nome, setNome] = useState('')
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  const loadItems = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from(activeTab)
      .select('id, nome, ativo')
      .order('nome')
    setItems(data ?? [])
    setLoading(false)
  }, [activeTab])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  function openCreate() {
    setEditItem(null)
    setNome('')
    setModalOpen(true)
  }

  function openEdit(item: CadastroItem) {
    setEditItem(item)
    setNome(item.nome)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!nome.trim()) return
    setSaving(true)

    if (editItem) {
      await supabase.from(activeTab).update({ nome: nome.trim() }).eq('id', editItem.id)
    } else {
      await supabase.from(activeTab).insert({ nome: nome.trim() })
    }

    setSaving(false)
    setModalOpen(false)
    loadItems()
  }

  async function toggleAtivo(item: CadastroItem) {
    await supabase.from(activeTab).update({ ativo: !item.ativo }).eq('id', item.id)
    loadItems()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b border-slate-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4" />
          Novo
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : items.length === 0 ? (
          <EmptyState title="Nenhum registro" description="Clique em Novo para adicionar." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 w-28">Status</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 w-32">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{item.nome}</td>
                  <td className="px-4 py-3">
                    <Badge className={item.ativo ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}>
                      {item.ativo ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                        title="Editar"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleAtivo(item)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 rounded cursor-pointer"
                        title={item.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {item.ativo ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar' : 'Novo'}
        size="sm"
      >
        <div className="space-y-4">
          <Input
            id="nome"
            label="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite o nome..."
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
