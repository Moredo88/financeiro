-- ============================================================
-- Controle de Acoes: quadro Kanban compartilhado entre usuarios
-- ============================================================
--
-- Diferente de anotacoes (pessoal, dono-a-dono), acao e um dado de
-- EQUIPE: qualquer usuario autenticado ve e edita qualquer acao, no
-- mesmo padrao de lancamentos e movimentacoes_ativos. A unica regra
-- de permissao nova e a exclusao, restrita a admin ou a quem criou.
--
-- Rode no SQL Editor do Supabase. E idempotente.

-- ============================================================
-- 1. Areas/Projetos (cadastro simples, mesmo shape de categorias/
--    classes/contas — a aba nova em Configuracoes reaproveita a
--    logica generica que ja existe ali, sem tela propria)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.areas_projeto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.areas_projeto ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'areas_projeto' AND policyname = 'auth_full_access'
  ) THEN
    CREATE POLICY "auth_full_access" ON public.areas_projeto FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- ============================================================
-- 2. Acoes
-- ============================================================

CREATE TABLE IF NOT EXISTS public.acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  titulo    text NOT NULL,
  descricao text NOT NULL DEFAULT '',

  responsavel_id  uuid NOT NULL REFERENCES auth.users,
  solicitante_id  uuid REFERENCES auth.users,
  area_projeto_id uuid REFERENCES public.areas_projeto(id),

  status text NOT NULL DEFAULT 'Backlog' CHECK (status IN (
    'Backlog', 'A Fazer', 'Em Andamento', 'Aguardando', 'Concluido', 'Cancelado'
  )),
  prioridade text NOT NULL DEFAULT 'Media' CHECK (prioridade IN (
    'Baixa', 'Media', 'Alta', 'Urgente'
  )),

  data_inicio date,
  prazo       date NOT NULL,

  percentual_conclusao smallint NOT NULL DEFAULT 0
    CHECK (percentual_conclusao BETWEEN 0 AND 100),

  tags text[] NOT NULL DEFAULT '{}',
  observacoes text,

  -- DEFAULT auth.uid() deixa o insert do cliente sem passar o criador;
  -- usado pela policy de exclusao abaixo.
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acoes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acoes' AND policyname = 'auth_select'
  ) THEN
    CREATE POLICY "auth_select" ON public.acoes FOR SELECT USING (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acoes' AND policyname = 'auth_insert'
  ) THEN
    CREATE POLICY "auth_insert" ON public.acoes FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acoes' AND policyname = 'auth_update'
  ) THEN
    CREATE POLICY "auth_update" ON public.acoes FOR UPDATE USING (auth.uid() IS NOT NULL);
  END IF;
  -- Excluir e mais restrito: so quem criou a acao, ou admin.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acoes' AND policyname = 'dono_ou_admin_delete'
  ) THEN
    CREATE POLICY "dono_ou_admin_delete" ON public.acoes
      FOR DELETE USING (public.is_admin() OR created_by = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acoes_status ON public.acoes(status);
CREATE INDEX IF NOT EXISTS idx_acoes_responsavel ON public.acoes(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_acoes_prazo ON public.acoes(prazo);

DROP TRIGGER IF EXISTS acoes_updated_at ON public.acoes;
CREATE TRIGGER acoes_updated_at
  BEFORE UPDATE ON public.acoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. Comentarios / timeline da acao
-- ============================================================
--
-- tipo='comentario' e o que o usuario escreve na caixa de comentario;
-- os demais sao inseridos automaticamente pelo codigo sempre que o
-- campo correspondente muda (ver useAcoes.salvarEdicao).

CREATE TABLE IF NOT EXISTS public.acoes_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_id uuid NOT NULL REFERENCES public.acoes(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users,

  tipo text NOT NULL CHECK (tipo IN ('comentario', 'status', 'responsavel', 'prazo')),
  texto text NOT NULL,

  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.acoes_comentarios ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'acoes_comentarios' AND policyname = 'auth_full_access'
  ) THEN
    CREATE POLICY "auth_full_access" ON public.acoes_comentarios FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_acoes_comentarios_acao
  ON public.acoes_comentarios(acao_id, created_at);

-- ============================================================
-- Conferencia
-- ============================================================
-- SELECT * FROM public.acoes;
-- INSERT INTO public.areas_projeto (nome) VALUES ('Geral') ON CONFLICT DO NOTHING;
