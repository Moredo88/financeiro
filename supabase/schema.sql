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

CREATE POLICY "self_read" ON user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "admin_manage" ON user_roles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

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
