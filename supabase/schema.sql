-- ============================================================
-- CONTA CORRENTE - Schema Completo
-- ============================================================

-- Tabela de roles de usuário
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  role text NOT NULL CHECK (role IN ('admin', 'usuario')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER: roda com privilegios do dono da funcao (bypass de RLS),
-- evitando que a policy abaixo consulte user_roles dentro de si mesma
-- (o que causa "infinite recursion detected in policy for relation").
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

CREATE POLICY "self_read" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_manage" ON user_roles
  FOR ALL USING (public.is_admin());

-- ============================================================
-- TABELAS DE CADASTRO
-- ============================================================

CREATE TABLE categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON categorias FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON classes FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON contas FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE frequencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE frequencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON frequencias FOR ALL USING (auth.uid() IS NOT NULL);

-- ============================================================
-- TABELA PRINCIPAL DE LANÇAMENTOS
-- ============================================================

CREATE TABLE lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  valor numeric(12,2) NOT NULL,
  descricao text,
  categoria_id uuid REFERENCES categorias(id),
  classe_id uuid REFERENCES classes(id),
  frequencia_id uuid REFERENCES frequencias(id),
  conta_id uuid REFERENCES contas(id),
  parcial text,
  reembolso text,
  status text NOT NULL DEFAULT 'R' CHECK (status IN ('R', 'P')),
  observacao text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON lancamentos FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_lancamentos_data ON lancamentos(data);
CREATE INDEX idx_lancamentos_categoria ON lancamentos(categoria_id);
CREATE INDEX idx_lancamentos_classe ON lancamentos(classe_id);
CREATE INDEX idx_lancamentos_conta ON lancamentos(conta_id);
CREATE INDEX idx_lancamentos_frequencia ON lancamentos(frequencia_id);
CREATE INDEX idx_lancamentos_status ON lancamentos(status);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lancamentos_updated_at
  BEFORE UPDATE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DADOS INICIAIS (SEED)
-- ============================================================

INSERT INTO categorias (nome) VALUES
  ('Transporte'), ('Moradia'), ('Telefonia'), ('Alimentacao'),
  ('Lazer'), ('Proventos'), ('Cuidados Pessoais'), ('Transferencia'),
  ('Farmacia'), ('Vestuario'), ('Eletroeletronicos'), ('Saude'),
  ('Viagem'), ('Capacitacao'), ('R.E.A.A.'), ('Informatica'),
  ('Taxas'), ('Presentes'), ('Esporte'), ('OUTROS'),
  ('Investimento'), ('CCRED'), ('Mercado'), ('Fitness');

INSERT INTO classes (nome) VALUES
  ('Comum'), ('Leonardo'), ('Sergio'), ('Gus'),
  ('Marcia'), ('BPP'), ('ME');

INSERT INTO frequencias (nome) VALUES
  ('Mensal'), ('Pontual'), ('Semanal'), ('Anual'),
  ('Semestral'), ('Trimestral'), ('Diario');

INSERT INTO contas (nome) VALUES
  ('BRAD'), ('AMEX'), ('BC'), ('BI-PJ'), ('BTG-B'),
  ('BTG-C'), ('BTG-E'), ('CC - XP'), ('CC-INTER'),
  ('CCItau'), ('D-Itau'), ('DPM'), ('Drawer'), ('INTER'),
  ('ITAU'), ('JA'), ('Marcia'), ('MG'), ('NU-CRED'),
  ('NU-PF'), ('PicPay'), ('SENIA'), ('SICR'), ('VISA'),
  ('VISA-BB'), ('Wallet'), ('XP');

-- ============================================================
-- MODULO DE INVESTIMENTOS
-- ============================================================

-- ---------- Lookups ----------

CREATE TABLE classes_ativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE classes_ativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON classes_ativo FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE categorias_ativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categorias_ativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON categorias_ativo FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE segmentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE segmentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON segmentos FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE bancos_corretoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bancos_corretoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON bancos_corretoras FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE casas_analise (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE casas_analise ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON casas_analise FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE carteiras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE carteiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON carteiras FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE estrategias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE estrategias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON estrategias FOR ALL USING (auth.uid() IS NOT NULL);

CREATE TABLE tags_exposicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tags_exposicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON tags_exposicao FOR ALL USING (auth.uid() IS NOT NULL);

-- ---------- Ativos (cadastro + parametros) ----------

CREATE TABLE ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cadastro
  -- ticker nao e unico: o mesmo papel em corretoras diferentes e um ativo
  -- distinto (posicao, preco medio e parametros proprios).
  ticker text NOT NULL,
  nome text,
  classe_id uuid REFERENCES classes_ativo(id),
  categoria_id uuid REFERENCES categorias_ativo(id),
  segmento_id uuid REFERENCES segmentos(id),
  banco_corretora_id uuid REFERENCES bancos_corretoras(id),
  casa_analise_id uuid REFERENCES casas_analise(id),
  gestora_securitizadora text,
  fonte_recomendacao text,
  descricao text,
  data_aquisicao date,
  status text NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo', 'Inativo', 'Liquidado')),

  -- Parametros
  carteira_id uuid REFERENCES carteiras(id),
  estrategia_id uuid REFERENCES estrategias(id),
  alocacao_alvo numeric(5,2),
  aporte_planejado numeric(14,2),
  recomendacao_atual text CHECK (recomendacao_atual IN ('Comprar', 'Manter', 'Vender', 'N/A')),
  liquidez text CHECK (liquidez IN ('Alta', 'Media', 'Baixa')),
  retorno_12m numeric(6,2),
  preco_teto numeric(14,4),
  cotacao_atual numeric(14,4),
  cotacao_atualizada_em timestamptz,

  -- Cadastro (tela Ativos)
  taxa numeric(8,4),
  data_vencimento date,

  -- Especificos de Renda Fixa (tela Parametros)
  indexador text CHECK (indexador IN (
    'PRÉ-FIX', 'PÓS-FIX (CDI)', 'IPCA (INFLAÇÃO)', 'SEM RETORNO', 'VARIÁVEL', 'DÓLAR'
  )),
  amortizacao text CHECK (amortizacao IN ('Vencimento', 'Semestral', 'Mensal')),
  juros text CHECK (juros IN ('Vencimento', 'Semestral', 'Mensal')),
  data_liquidacao date,
  saldo_devedor numeric(14,2),

  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON ativos FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ativos_ticker ON ativos(ticker);
CREATE INDEX idx_ativos_classe ON ativos(classe_id);
CREATE INDEX idx_ativos_status ON ativos(status);
CREATE INDEX idx_ativos_carteira ON ativos(carteira_id);

CREATE TRIGGER ativos_updated_at
  BEFORE UPDATE ON ativos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE ativo_tags (
  ativo_id uuid NOT NULL REFERENCES ativos(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags_exposicao(id) ON DELETE CASCADE,
  PRIMARY KEY (ativo_id, tag_id)
);

ALTER TABLE ativo_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON ativo_tags FOR ALL USING (auth.uid() IS NOT NULL);

-- ---------- Movimentacoes ----------

CREATE TABLE movimentacoes_ativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ativo_id uuid NOT NULL REFERENCES ativos(id),
  data_evento date NOT NULL,
  tipo_evento text NOT NULL CHECK (tipo_evento IN (
    'Compra', 'Venda', 'Dividendo', 'JCP', 'Rendimento',
    'Cupom', 'Amortizacao', 'Bonificacao', 'Subscricao'
  )),
  instituicao_id uuid REFERENCES bancos_corretoras(id),
  quantidade numeric(18,8),
  preco_unitario numeric(14,4),
  valor_liquido numeric(14,2),
  descricao text,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE movimentacoes_ativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_full_access" ON movimentacoes_ativos FOR ALL USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_mov_ativos_ativo ON movimentacoes_ativos(ativo_id);
CREATE INDEX idx_mov_ativos_data ON movimentacoes_ativos(data_evento);
CREATE INDEX idx_mov_ativos_tipo ON movimentacoes_ativos(tipo_evento);

CREATE TRIGGER movimentacoes_ativos_updated_at
  BEFORE UPDATE ON movimentacoes_ativos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------- Seeds ----------

INSERT INTO classes_ativo (nome) VALUES
  ('Acao'), ('FII'), ('ETF'), ('Renda Fixa'), ('Estruturada');

INSERT INTO categorias_ativo (nome) VALUES
  ('Tijolo'), ('Papel'), ('CDB'), ('CRA'), ('CRI'), ('Debenture'), ('LCI'), ('LCA');

INSERT INTO segmentos (nome) VALUES
  ('Educacao'), ('Varejo'), ('Financeiro (IFNC)'), ('Energia'),
  ('Saneamento'), ('Shoppings'), ('Logistica'), ('Papel e Celulose'), ('Tecnologia');

INSERT INTO bancos_corretoras (nome) VALUES
  ('XP'), ('BTG'), ('Itau'), ('Nu Invest'), ('Rico'), ('Clear');

INSERT INTO casas_analise (nome) VALUES
  ('Eleven'), ('GPT'), ('PVT'), ('Suno'), ('Empiricus');

INSERT INTO carteiras (nome) VALUES
  ('Carteira'), ('Top Picks'), ('Carrego');

INSERT INTO estrategias (nome) VALUES
  ('Carrego'), ('Trade'), ('Dividendos'), ('Valorizacao');

INSERT INTO tags_exposicao (nome) VALUES
  ('FIN'), ('UTL'), ('SML'), ('DIV');
