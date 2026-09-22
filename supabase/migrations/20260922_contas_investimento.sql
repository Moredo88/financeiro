-- ============================================================
-- Conta (titular) do ativo de investimento
-- ============================================================
--
-- Cadastro simples, mesmo shape de carteiras/estrategias, gerenciado
-- na aba "Contas" de Investimentos > Parametros. Nao reaproveita a
-- tabela `contas`, que e das contas de Lancamentos.
--
-- Todos os ativos ja cadastrados ficam na conta 'Sergio'.
--
-- Rode no SQL Editor do Supabase. E idempotente.

CREATE TABLE IF NOT EXISTS public.contas_investimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.contas_investimento ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'contas_investimento' AND policyname = 'auth_full_access'
  ) THEN
    CREATE POLICY "auth_full_access" ON public.contas_investimento FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

INSERT INTO public.contas_investimento (nome) VALUES
  ('Marcia'), ('Sergio'), ('BPP'), ('Gustavo'), ('Leonardo'), ('Nilza')
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE public.ativos
  ADD COLUMN IF NOT EXISTS conta_investimento_id uuid REFERENCES public.contas_investimento(id);

UPDATE public.ativos
SET conta_investimento_id = (SELECT id FROM public.contas_investimento WHERE nome = 'Sergio')
WHERE conta_investimento_id IS NULL;

NOTIFY pgrst, 'reload schema';
