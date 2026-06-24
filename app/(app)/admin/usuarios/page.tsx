'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { Plus, Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  role: string
  created_at: string
}

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('usuario')
  const [saving, setSaving] = useState(false)

  async function loadUsers() {
    setLoading(true)
    const res = await fetch('/api/admin/usuarios')
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { loadUsers() }, [])

  async function handleCreate() {
    if (!email || !password) return
    setSaving(true)
    await fetch('/api/admin/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    })
    setSaving(false)
    setModalOpen(false)
    setEmail('')
    setPassword('')
    setRole('usuario')
    loadUsers()
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este usuario?')) return
    await fetch(`/api/admin/usuarios/${id}`, { method: 'DELETE' })
    loadUsers()
  }

  async function handleRoleChange(id: string, newRole: string) {
    await fetch(`/api/admin/usuarios/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    loadUsers()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => setModalOpen(true)} size="sm">
          <Plus className="h-4 w-4" />
          Novo Usuario
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
        ) : users.length === 0 ? (
          <EmptyState title="Nenhum usuario" description="Clique em Novo para adicionar." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 text-left font-medium text-slate-600 w-40">Role</th>
                <th className="px-4 py-3 text-right font-medium text-slate-600 w-24">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-900">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="text-sm border border-slate-300 rounded px-2 py-1"
                    >
                      <option value="admin">Admin</option>
                      <option value="usuario">Usuario</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Novo Usuario" size="sm">
        <div className="space-y-4">
          <Input
            id="u-email"
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            id="u-password"
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Select
            id="u-role"
            label="Role"
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'usuario', label: 'Usuario' },
            ]}
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} loading={saving}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
