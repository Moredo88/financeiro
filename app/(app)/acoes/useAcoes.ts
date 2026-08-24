'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Acao, AreaProjeto, Comentario, Status, Usuario } from './types'

const CAMPOS_ACAO =
  'id, titulo, descricao, responsavel_id, solicitante_id, area_projeto_id, status, prioridade, data_inicio, prazo, percentual_conclusao, tags, observacoes, created_by, created_at, updated_at'

/** Erro de tabela ausente: migracao ainda nao rodada no Supabase. */
function ehTabelaAusente(error: { code?: string; message: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /schema cache/i.test(error.message)
}

export function useAcoes() {
  const supabase = useMemo(() => createClient(), [])

  const [acoes, setAcoes] = useState<Acao[]>([])
  const [areas, setAreas] = useState<AreaProjeto[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)

    const [{ data: { user } }, acoesRes, areasRes, usuariosRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('acoes').select(CAMPOS_ACAO).order('updated_at', { ascending: false }),
      supabase.from('areas_projeto').select('id, nome, ativo').eq('ativo', true).order('nome'),
      fetch('/api/usuarios').then((r) => (r.ok ? r.json() : { users: [] })).catch(() => ({ users: [] })),
    ])

    if (acoesRes.error) {
      setErro(
        ehTabelaAusente(acoesRes.error)
          ? 'As tabelas de Acoes ainda nao existem no banco. Rode a migracao supabase/migrations/20260825_acoes.sql no SQL Editor do Supabase.'
          : `Nao foi possivel carregar as acoes: ${acoesRes.error.message}`
      )
      setAcoes([])
    } else {
      setErro(null)
      setAcoes(acoesRes.data ?? [])
    }

    // Cadastro auxiliar: se ainda nao existir, o modulo funciona sem area/
    // projeto em vez de travar a tela inteira por causa dele.
    setAreas(areasRes.error ? [] : (areasRes.data ?? []))
    setUsuarios(usuariosRes.users ?? [])

    if (user) {
      setUserId(user.id)
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single()
      setIsAdmin(roleRow?.role === 'admin')
    }

    setCarregando(false)
  }, [supabase])

  useEffect(() => {
    carregar()
  }, [carregar])

  const podeExcluir = useCallback(
    (acao: Acao) => isAdmin || acao.created_by === userId,
    [isAdmin, userId]
  )

  async function registrarComentario(acaoId: string, tipo: Comentario['tipo'], texto: string) {
    await supabase.from('acoes_comentarios').insert({ acao_id: acaoId, tipo, texto })
  }

  async function criar(campos: {
    titulo: string
    descricao: string
    responsavel_id: string
    solicitante_id: string | null
    area_projeto_id: string | null
    status: Status
    prioridade: Acao['prioridade']
    data_inicio: string | null
    prazo: string
    tags: string[]
    observacoes: string
  }) {
    const { data, error } = await supabase
      .from('acoes')
      .insert(campos)
      .select(CAMPOS_ACAO)
      .single()

    if (error) {
      alert(`Nao foi possivel criar a acao: ${error.message}`)
      return null
    }
    if (data) setAcoes((prev) => [data, ...prev])
    return data
  }

  /**
   * Unico caminho de edicao do modulo — usado pelo modal, pelo drag do
   * Kanban e pelo <select> rapido de status no card. Centralizar aqui e o
   * que garante que status/responsavel/prazo alterados por qualquer via
   * sempre viram uma linha na timeline: nenhum atalho pode esquecer de
   * logar porque nenhum atalho grava direto na tabela.
   */
  async function salvarEdicao(acao: Acao, campos: Partial<Acao>) {
    const { data, error } = await supabase
      .from('acoes')
      .update(campos)
      .eq('id', acao.id)
      .select(CAMPOS_ACAO)
      .single()

    if (error) {
      alert(`Nao foi possivel salvar: ${error.message}`)
      return false
    }
    if (!data) return false

    setAcoes((prev) => prev.map((a) => (a.id === acao.id ? data : a)))

    const nomeUsuario = (id: string | null) =>
      id ? (usuarios.find((u) => u.id === id)?.email ?? 'alguem') : 'ninguem'

    if (campos.status !== undefined && campos.status !== acao.status) {
      await registrarComentario(acao.id, 'status', `Status alterado de "${acao.status}" para "${campos.status}"`)
    }
    if (campos.responsavel_id !== undefined && campos.responsavel_id !== acao.responsavel_id) {
      await registrarComentario(
        acao.id,
        'responsavel',
        `Responsavel alterado de ${nomeUsuario(acao.responsavel_id)} para ${nomeUsuario(campos.responsavel_id)}`
      )
    }
    if (campos.prazo !== undefined && campos.prazo !== acao.prazo) {
      await registrarComentario(acao.id, 'prazo', `Prazo alterado de ${acao.prazo} para ${campos.prazo}`)
    }

    return true
  }

  async function excluir(acao: Acao) {
    const { error } = await supabase.from('acoes').delete().eq('id', acao.id)
    if (error) {
      alert(`Nao foi possivel excluir: ${error.message}`)
      return false
    }
    setAcoes((prev) => prev.filter((a) => a.id !== acao.id))
    return true
  }

  async function duplicar(acao: Acao) {
    return criar({
      titulo: `${acao.titulo} (copia)`,
      descricao: acao.descricao,
      responsavel_id: acao.responsavel_id,
      solicitante_id: acao.solicitante_id,
      area_projeto_id: acao.area_projeto_id,
      status: 'Backlog',
      prioridade: acao.prioridade,
      data_inicio: acao.data_inicio,
      prazo: acao.prazo,
      tags: acao.tags,
      observacoes: acao.observacoes ?? '',
    })
  }

  async function comentar(acaoId: string, texto: string) {
    const { error } = await supabase
      .from('acoes_comentarios')
      .insert({ acao_id: acaoId, tipo: 'comentario', texto })
    if (error) alert(`Nao foi possivel comentar: ${error.message}`)
    return !error
  }

  async function carregarComentarios(acaoId: string): Promise<Comentario[]> {
    const { data } = await supabase
      .from('acoes_comentarios')
      .select('id, acao_id, autor_id, tipo, texto, created_at')
      .eq('acao_id', acaoId)
      .order('created_at', { ascending: true })
    return data ?? []
  }

  return {
    acoes,
    areas,
    usuarios,
    userId,
    isAdmin,
    carregando,
    erro,
    recarregar: carregar,
    podeExcluir,
    criar,
    salvarEdicao,
    excluir,
    duplicar,
    comentar,
    carregarComentarios,
  }
}
