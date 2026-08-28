-- ============================================================
-- Progresso do Plano de Trading: quais tarefas diarias da trilha
-- de 13 semanas (app/(app)/plano-trading/page.tsx) o usuario ja
-- marcou como concluidas
-- ============================================================
--
-- Dado pessoal, no mesmo espirito de anotacoes: cada usuario ve e
-- marca so o proprio progresso. Guarda apenas as tarefas
-- CONCLUIDAS — desmarcar uma tarefa apaga a linha, em vez de
-- gravar concluida=false. A chave da tarefa e o par
-- "<indice da semana>-<indice da tarefa>" gerado no proprio
-- componente (DATA e estatico, definido no codigo, nao no banco).
--
-- Rode no SQL Editor do Supabase. E idempotente.

CREATE TABLE IF NOT EXISTS public.plano_trading_progresso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- DEFAULT auth.uid() deixa o insert do cliente sem passar o dono,
  -- e a policy WITH CHECK impede que ele passe o de outra pessoa.
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,

  tarefa_chave text NOT NULL,
  concluida_em timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, tarefa_chave)
);

ALTER TABLE public.plano_trading_progresso ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plano_trading_progresso' AND policyname = 'dono_total'
  ) THEN
    CREATE POLICY "dono_total" ON public.plano_trading_progresso
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_plano_trading_progresso_user
  ON public.plano_trading_progresso(user_id);

-- ============================================================
-- Conferencia
-- ============================================================
-- SELECT * FROM public.plano_trading_progresso;
-- Logado como outro usuario, o SELECT acima deve vir vazio.
