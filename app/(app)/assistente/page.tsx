'use client'

import { useState, useRef, useEffect } from 'react'
import Button from '@/components/ui/Button'
import { Send, Sparkles, User, Trash2 } from 'lucide-react'

interface Mensagem {
  role: 'user' | 'assistant'
  content: string
}

const SUGESTOES = [
  'Quanto gastei por categoria nos ultimos 12 meses?',
  'Quais foram meus 5 maiores lancamentos deste ano?',
  'Como esta a minha carteira de investimentos hoje?',
  'Quanto recebi de proventos ate agora?',
]

/** Renderiza o texto do assistente: negrito com **, listas e tabelas simples. */
function Markdown({ texto }: { texto: string }) {
  const linhas = texto.split('\n')

  function inline(t: string) {
    return t.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
      parte.startsWith('**') && parte.endsWith('**') ? (
        <strong key={i} className="font-semibold text-slate-900">{parte.slice(2, -2)}</strong>
      ) : (
        <span key={i}>{parte}</span>
      )
    )
  }

  return (
    <div className="space-y-1.5">
      {linhas.map((linha, i) => {
        const t = linha.trim()
        if (!t) return <div key={i} className="h-1" />
        // Linha separadora de tabela markdown
        if (/^\|?[\s|:-]+\|[\s|:-]*$/.test(t) && t.includes('-')) return null
        if (t.startsWith('|')) {
          const celulas = t.split('|').slice(1, -1).map((c) => c.trim())
          return (
            <div key={i} className="flex gap-3 text-sm border-b border-slate-100 py-1">
              {celulas.map((c, j) => (
                <span key={j} className={j === 0 ? 'flex-1 text-slate-700' : 'text-right text-slate-900 tabular-nums'}>
                  {inline(c)}
                </span>
              ))}
            </div>
          )
        }
        if (/^[-*]\s/.test(t)) {
          return (
            <div key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="text-slate-400">•</span>
              <span>{inline(t.replace(/^[-*]\s/, ''))}</span>
            </div>
          )
        }
        return <p key={i} className="text-sm text-slate-700 leading-relaxed">{inline(t)}</p>
      })}
    </div>
  )
}

export default function AssistentePage() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([])
  const [input, setInput] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const fimRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, carregando])

  async function enviar(texto: string) {
    const pergunta = texto.trim()
    if (!pergunta || carregando) return

    setErro(null)
    setInput('')
    const novoHistorico: Mensagem[] = [...mensagens, { role: 'user', content: pergunta }]
    setMensagens(novoHistorico)
    setCarregando(true)

    try {
      const res = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: novoHistorico }),
      })
      const data = await res.json()

      if (!res.ok) {
        setErro(data.error ?? 'Falha ao consultar o assistente.')
        return
      }
      setMensagens([...novoHistorico, { role: 'assistant', content: data.reply }])
    } catch {
      setErro('Nao foi possivel falar com o servidor. Verifique sua conexao.')
    } finally {
      setCarregando(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviar(input)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-9rem)]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">
          Pergunte sobre seus lancamentos e investimentos — o assistente consulta seus dados reais.
        </p>
        {mensagens.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setMensagens([]); setErro(null) }}>
            <Trash2 className="h-4 w-4" />
            Limpar conversa
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-5">
        {mensagens.length === 0 && !carregando && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-5">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-blue-50 text-blue-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Como posso ajudar?</h3>
              <p className="mt-1 text-sm text-slate-500">Escolha uma sugestao ou escreva sua pergunta.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl">
              {SUGESTOES.map((s) => (
                <button
                  key={s}
                  onClick={() => enviar(s)}
                  className="text-left text-sm text-slate-600 border border-slate-200 rounded-lg px-3 py-2.5 hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensagens.map((m, i) => (
          <div key={i} className="flex gap-3">
            <div
              className={`flex items-center justify-center h-8 w-8 rounded-lg shrink-0 ${
                m.role === 'user' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'
              }`}
            >
              {m.role === 'user' ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              {m.role === 'user' ? (
                <p className="text-sm text-slate-900 whitespace-pre-wrap">{m.content}</p>
              ) : (
                <Markdown texto={m.content} />
              )}
            </div>
          </div>
        ))}

        {carregando && (
          <div className="flex gap-3">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-50 text-blue-600 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-1.5 pt-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 animate-bounce" />
              <span className="ml-2 text-xs text-slate-400">consultando seus dados...</span>
            </div>
          </div>
        )}

        <div ref={fimRef} />
      </div>

      {erro && (
        <div className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte algo sobre suas financas..."
          rows={2}
          disabled={carregando}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-slate-50"
        />
        <Button onClick={() => enviar(input)} loading={carregando} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
          Enviar
        </Button>
      </div>
    </div>
  )
}
