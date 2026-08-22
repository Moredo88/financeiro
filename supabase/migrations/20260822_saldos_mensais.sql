-- ============================================================
-- Historico de saldos: fechamento mensal no primeiro dia util
-- ============================================================
--
-- Motivo: ativos.cotacao_atual e ativos.saldo_devedor sao sobrescritos a
-- cada atualizacao. O sistema so sabia dizer quanto o patrimonio vale
-- HOJE — nao havia como montar serie historica nem medir rendimento.
--
-- Modelo em dois niveis:
--   fechamentos    -> o mes de referencia (competencia + data do extrato)
--   saldos_mensais -> uma linha por ativo dentro do fechamento
--
-- Rode no SQL Editor do Supabase. E idempotente.

-- ============================================================
-- 1. Feriados e primeiro dia util
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feriados (
  data date PRIMARY KEY,
  nome text NOT NULL
);

ALTER TABLE public.feriados ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'feriados' AND policyname = 'auth_full_access'
  ) THEN
    CREATE POLICY "auth_full_access" ON public.feriados FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Domingo de Pascoa (algoritmo de Meeus/Jones/Butcher). Serve de ancora
-- para Carnaval, Sexta-feira Santa e Corpus Christi.
CREATE OR REPLACE FUNCTION public.pascoa(ano int)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  a int; b int; c int; d int; e int; f int;
  g int; h int; i int; k int; l int; m int;
BEGIN
  a := ano % 19;
  b := ano / 100;
  c := ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  RETURN make_date(ano, (h + l - 7 * m + 114) / 31, ((h + l - 7 * m + 114) % 31) + 1);
END $$;

-- Carrega os feriados nacionais do periodo. Feriado municipal ou ponto
-- facultativo que voce queira considerar e so inserir na mao em feriados.
CREATE OR REPLACE FUNCTION public.gerar_feriados(ano_ini int, ano_fim int)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  ano int;
  p date;
BEGIN
  FOR ano IN ano_ini..ano_fim LOOP
    p := public.pascoa(ano);

    INSERT INTO public.feriados (data, nome) VALUES
      (make_date(ano, 1, 1),   'Confraternizacao Universal'),
      (p - 48,                 'Carnaval'),
      (p - 47,                 'Carnaval'),
      (p - 2,                  'Sexta-feira Santa'),
      (make_date(ano, 4, 21),  'Tiradentes'),
      (make_date(ano, 5, 1),   'Dia do Trabalho'),
      (p + 60,                 'Corpus Christi'),
      (make_date(ano, 9, 7),   'Independencia'),
      (make_date(ano, 10, 12), 'Nossa Senhora Aparecida'),
      (make_date(ano, 11, 2),  'Finados'),
      (make_date(ano, 11, 15), 'Proclamacao da Republica'),
      (make_date(ano, 12, 25), 'Natal')
    ON CONFLICT (data) DO NOTHING;

    -- Consciencia Negra so virou feriado nacional pela Lei 14.759/2023.
    IF ano >= 2024 THEN
      INSERT INTO public.feriados (data, nome)
      VALUES (make_date(ano, 11, 20), 'Consciencia Negra')
      ON CONFLICT (data) DO NOTHING;
    END IF;
  END LOOP;

  RETURN (SELECT count(*)::int FROM public.feriados
          WHERE extract(year FROM data) BETWEEN ano_ini AND ano_fim);
END $$;

-- 2021 cobre o backfill (a movimentacao mais antiga e de 05/2021);
-- 2035 da folga para os proximos anos.
SELECT public.gerar_feriados(2021, 2035);

-- Primeiro dia do mes que nao e sabado, domingo nem feriado.
CREATE OR REPLACE FUNCTION public.primeiro_dia_util(competencia date)
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT min(d)::date
  FROM generate_series(
         date_trunc('month', competencia)::date,
         (date_trunc('month', competencia) + interval '1 month - 1 day')::date,
         interval '1 day'
       ) AS d
  WHERE extract(isodow FROM d) < 6
    AND NOT EXISTS (SELECT 1 FROM public.feriados f WHERE f.data = d::date)
$$;

-- ============================================================
-- 2. Fechamentos (o mes)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fechamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Sempre o dia 1 do mes de referencia. E a chave de leitura dos graficos.
  competencia date NOT NULL UNIQUE CHECK (extract(day FROM competencia) = 1),

  -- Data efetiva do extrato. Normalmente primeiro_dia_util(competencia),
  -- mas fica editavel: quem importa com atraso registra o dia real.
  data_posicao date NOT NULL,

  status text NOT NULL DEFAULT 'Aberto' CHECK (status IN ('Aberto', 'Fechado')),
  observacao text,

  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.fechamentos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'fechamentos' AND policyname = 'auth_full_access'
  ) THEN
    CREATE POLICY "auth_full_access" ON public.fechamentos FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

DROP TRIGGER IF EXISTS fechamentos_updated_at ON public.fechamentos;
CREATE TRIGGER fechamentos_updated_at
  BEFORE UPDATE ON public.fechamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 3. Saldos mensais (uma linha por ativo no fechamento)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.saldos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fechamento_id uuid NOT NULL REFERENCES public.fechamentos(id) ON DELETE CASCADE,
  ativo_id uuid NOT NULL REFERENCES public.ativos(id) ON DELETE CASCADE,

  quantidade     numeric(18,8),
  preco_unitario numeric(14,6),

  -- O numero que interessa: valor de mercado do ativo na data_posicao.
  saldo numeric(14,2) NOT NULL,

  -- Movimento do periodo (do fechamento anterior ate este). Sem separar
  -- aporte de rendimento, variacao de saldo nao e rendimento: um aporte
  -- de 10 mil apareceria como lucro.
  aportes_mes   numeric(14,2) NOT NULL DEFAULT 0,
  resgates_mes  numeric(14,2) NOT NULL DEFAULT 0,
  proventos_mes numeric(14,2) NOT NULL DEFAULT 0,

  -- B3      = veio do extrato de posicao
  -- Manual  = digitado
  -- Repetido = copiado do mes anterior sem conferencia
  origem text NOT NULL DEFAULT 'Manual' CHECK (origem IN ('B3', 'Manual', 'Repetido')),

  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (fechamento_id, ativo_id)
);

ALTER TABLE public.saldos_mensais ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'saldos_mensais' AND policyname = 'auth_full_access'
  ) THEN
    CREATE POLICY "auth_full_access" ON public.saldos_mensais FOR ALL USING (auth.uid() IS NOT NULL);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_saldos_fechamento ON public.saldos_mensais(fechamento_id);
CREATE INDEX IF NOT EXISTS idx_saldos_ativo ON public.saldos_mensais(ativo_id);

DROP TRIGGER IF EXISTS saldos_mensais_updated_at ON public.saldos_mensais;
CREATE TRIGGER saldos_mensais_updated_at
  BEFORE UPDATE ON public.saldos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Mes fechado nao muda mais. Reabrir e acao explicita na tela.
CREATE OR REPLACE FUNCTION public.bloquear_fechamento_fechado()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  situacao text;
BEGIN
  -- Em DELETE nao existe NEW e em INSERT nao existe OLD: ler o campo do
  -- registro errado levanta "record is not assigned yet". Dai o TG_OP.
  IF TG_OP = 'DELETE' THEN
    SELECT status INTO situacao FROM public.fechamentos WHERE id = OLD.fechamento_id;
  ELSE
    SELECT status INTO situacao FROM public.fechamentos WHERE id = NEW.fechamento_id;
  END IF;

  IF situacao = 'Fechado' THEN
    RAISE EXCEPTION 'Competencia ja fechada. Reabra o fechamento antes de alterar os saldos.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- UPDATE que tire a linha de um fechamento aberto para um ja fechado
  -- tambem precisa barrar: o teste acima olhou so o destino.
  IF TG_OP = 'UPDATE' AND OLD.fechamento_id IS DISTINCT FROM NEW.fechamento_id THEN
    SELECT status INTO situacao FROM public.fechamentos WHERE id = OLD.fechamento_id;
    IF situacao = 'Fechado' THEN
      RAISE EXCEPTION 'Competencia de origem ja fechada. Reabra o fechamento antes de alterar os saldos.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS saldos_mensais_bloqueio ON public.saldos_mensais;
CREATE TRIGGER saldos_mensais_bloqueio
  BEFORE INSERT OR UPDATE OR DELETE ON public.saldos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_fechamento_fechado();

-- ============================================================
-- 4. View de leitura para os dashboards
-- ============================================================
--
-- Traz cada saldo ja com os nomes dos cadastros, o saldo do mes anterior
-- do MESMO ativo e o rendimento do periodo.
--
-- rendimento_mes fica NULL quando nao ha como medir: primeiro retrato do
-- ativo no sistema e sem aporte declarado no periodo. Somar NULL como
-- zero no dashboard e o comportamento correto — o mes de entrada nao tem
-- rendimento apurado.

DROP VIEW IF EXISTS public.v_saldos_mensais;

CREATE VIEW public.v_saldos_mensais
WITH (security_invoker = on)
AS
SELECT
  s.id,
  s.fechamento_id,
  f.competencia,
  f.data_posicao,
  f.status AS fechamento_status,

  s.ativo_id,
  a.ticker,
  a.nome  AS ativo_nome,
  a.status AS ativo_status,
  a.classe_id,
  a.categoria_id,
  a.segmento_id,
  a.banco_corretora_id,
  a.casa_analise_id,
  a.carteira_id,
  a.estrategia_id,
  cl.nome AS classe_nome,
  ca.nome AS categoria_nome,
  sg.nome AS segmento_nome,
  bc.nome AS corretora_nome,
  ct.nome AS carteira_nome,
  es.nome AS estrategia_nome,

  s.quantidade,
  s.preco_unitario,
  s.saldo,
  s.aportes_mes,
  s.resgates_mes,
  s.proventos_mes,
  s.origem,

  lag(s.saldo) OVER w AS saldo_anterior,

  CASE
    WHEN lag(s.saldo) OVER w IS NOT NULL
      THEN s.saldo - lag(s.saldo) OVER w - s.aportes_mes + s.resgates_mes + s.proventos_mes
    WHEN s.aportes_mes > 0
      THEN s.saldo - s.aportes_mes + s.resgates_mes + s.proventos_mes
    ELSE NULL
  END AS rendimento_mes

FROM public.saldos_mensais s
JOIN public.fechamentos f ON f.id = s.fechamento_id
JOIN public.ativos a ON a.id = s.ativo_id
LEFT JOIN public.classes_ativo    cl ON cl.id = a.classe_id
LEFT JOIN public.categorias_ativo ca ON ca.id = a.categoria_id
LEFT JOIN public.segmentos        sg ON sg.id = a.segmento_id
LEFT JOIN public.bancos_corretoras bc ON bc.id = a.banco_corretora_id
LEFT JOIN public.carteiras        ct ON ct.id = a.carteira_id
LEFT JOIN public.estrategias      es ON es.id = a.estrategia_id
WINDOW w AS (PARTITION BY s.ativo_id ORDER BY f.competencia);

GRANT SELECT ON public.v_saldos_mensais TO anon, authenticated, service_role;

-- ============================================================
-- Conferencia
-- ============================================================
-- SELECT public.primeiro_dia_util('2026-09-01');  -- deve dar 2026-09-01
-- SELECT public.primeiro_dia_util('2026-11-01');  -- 01/11/2026 e domingo -> 2026-11-03
-- SELECT * FROM public.v_saldos_mensais LIMIT 5;
