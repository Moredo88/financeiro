-- ============================================================
-- Relatorios de investimentos: historico mensal do relatorio
-- executivo gerado em /relatorio-carteira
-- ============================================================
--
-- Um registro por fechamento mensal (chave unica em fechamento_id):
-- gerar de novo e salvar ATUALIZA o mes, nunca duplica. Dado
-- compartilhado da casa, mesmo padrao de "acoes" — qualquer usuario
-- autenticado ve, gera e salva; exclusao fica restrita a quem criou
-- ou a admin.
--
-- "dados" e "narrativa" guardam o JSON que gerou o HTML (auditoria e
-- eventual re-render sem chamar a IA de novo); "conteudo_html" e o
-- documento pronto para exibir/imprimir.
--
-- Rode no SQL Editor do Supabase. E idempotente.

CREATE TABLE IF NOT EXISTS public.relatorios_investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL UNIQUE REFERENCES public.fechamentos(id) ON DELETE CASCADE,
  competencia date NOT NULL,

  patrimonio_ajustado numeric(14,2) NOT NULL,

  -- Selic/CDI/IPCA/dolar (BCB) + Ibovespa/IFIX/Tesouro (manual ou IA) +
  -- modo usado e fontes, quando aplicavel.
  benchmarks jsonb NOT NULL,

  -- Snapshot completo dos dados calculados (posicoes, alocacao, alertas,
  -- veredito por papel) que serviu de base para este relatorio.
  dados jsonb NOT NULL,

  -- Texto estruturado que a IA escreveu (diagnostico, plano de acao,
  -- top 10 etc.), separado dos numeros para facilitar auditoria.
  narrativa jsonb NOT NULL,

  conteudo_html text NOT NULL,

  gerado_em timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.relatorios_investimentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relatorios_investimentos' AND policyname = 'auth_select'
  ) THEN
    CREATE POLICY "auth_select" ON public.relatorios_investimentos FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relatorios_investimentos' AND policyname = 'auth_insert'
  ) THEN
    CREATE POLICY "auth_insert" ON public.relatorios_investimentos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relatorios_investimentos' AND policyname = 'auth_update'
  ) THEN
    CREATE POLICY "auth_update" ON public.relatorios_investimentos FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'relatorios_investimentos' AND policyname = 'dono_ou_admin_delete'
  ) THEN
    CREATE POLICY "dono_ou_admin_delete" ON public.relatorios_investimentos
      FOR DELETE USING (public.is_admin() OR created_by = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_relatorios_investimentos_competencia ON public.relatorios_investimentos(competencia);

DROP TRIGGER IF EXISTS relatorios_investimentos_updated_at ON public.relatorios_investimentos;
CREATE TRIGGER relatorios_investimentos_updated_at
  BEFORE UPDATE ON public.relatorios_investimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- Conferencia (rodar a mao apos a migracao, nao faz parte dela)
-- ============================================================
-- SELECT id, competencia, patrimonio_ajustado, gerado_em FROM public.relatorios_investimentos ORDER BY competencia DESC;
-- SELECT * FROM pg_policies WHERE tablename = 'relatorios_investimentos';
