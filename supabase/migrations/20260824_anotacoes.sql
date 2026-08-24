-- ============================================================
-- Anotacoes: bloco de notas rapido, no espirito do Google Keep
-- ============================================================
--
-- Diferente do resto do sistema, anotacao e um dado PESSOAL: cada
-- usuario ve apenas as suas. Por isso a policy aqui nao e o
-- "auth_full_access" das demais tabelas, e sim dono-a-dono.
--
-- Tags ficam em text[] na propria anotacao, e nao em cadastro +
-- tabela de ligacao como em ativo_tags/tags_exposicao. O motivo e o
-- objetivo da tela: escrever uma anotacao em segundos. Com cadastro,
-- usar uma tag nova exigiria sair da tela e registra-la antes. Como
-- tag de anotacao e rotulo livre e pessoal (nao alimenta relatorio
-- nem se cruza com outras tabelas), o array paga o custo certo.
--
-- Rode no SQL Editor do Supabase. E idempotente.

CREATE TABLE IF NOT EXISTS public.anotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- DEFAULT auth.uid() deixa o insert do cliente sem passar o dono,
  -- e a policy WITH CHECK impede que ele passe o de outra pessoa.
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,

  titulo    text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  tags      text[] NOT NULL DEFAULT '{}',

  fixada    boolean NOT NULL DEFAULT false,
  arquivada boolean NOT NULL DEFAULT false,

  -- Exclusao e logica: a linha sai da tela, mas continua recuperavel
  -- no banco. Nada na interface le anotacao com deleted_at preenchido.
  deleted_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.anotacoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'anotacoes' AND policyname = 'dono_total'
  ) THEN
    CREATE POLICY "dono_total" ON public.anotacoes
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Leitura da tela: as do usuario, ainda nao excluidas.
CREATE INDEX IF NOT EXISTS idx_anotacoes_user
  ON public.anotacoes(user_id, updated_at DESC)
  WHERE deleted_at IS NULL;

-- Filtro por tag usa o operador de sobreposicao de arrays (&&).
CREATE INDEX IF NOT EXISTS idx_anotacoes_tags
  ON public.anotacoes USING gin (tags);

DROP TRIGGER IF EXISTS anotacoes_updated_at ON public.anotacoes;
CREATE TRIGGER anotacoes_updated_at
  BEFORE UPDATE ON public.anotacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Conferencia
-- ============================================================
-- SELECT * FROM public.anotacoes WHERE deleted_at IS NULL;
-- Logado como outro usuario, o SELECT acima deve vir vazio.
