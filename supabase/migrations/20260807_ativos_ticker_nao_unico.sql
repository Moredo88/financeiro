-- ============================================================
-- Ativos: o mesmo ticker pode virar mais de um ativo
-- ============================================================
--
-- Motivo: o mesmo papel custodiado em corretoras diferentes (B3SA3 no
-- BTG e na XP, por exemplo) e um ativo distinto para efeito de posicao,
-- preco medio e parametros. A constraint UNIQUE em ticker impedia isso.
--
-- Nada de chave primaria muda: ativos.id (uuid) ja era a PK, e as FKs
-- de movimentacoes_ativos e ativo_tags sempre apontaram para ela. Cada
-- movimentacao continua amarrada ao registro exato onde foi lancada.
--
-- Nao ha regra de unicidade substituta: por decisao, qualquer numero de
-- registros do mesmo ticker e permitido.
--
-- Rode no SQL Editor do Supabase. E idempotente.

-- 1. Remove a constraint UNIQUE de ticker, seja qual for o nome dela.
DO $$
DECLARE
  nome_constraint text;
BEGIN
  FOR nome_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public'
      AND rel.relname = 'ativos'
      AND con.contype = 'u'
      AND (
        SELECT array_agg(att.attname)
        FROM unnest(con.conkey) AS k
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
      ) = ARRAY['ticker']
  LOOP
    EXECUTE format('ALTER TABLE public.ativos DROP CONSTRAINT %I', nome_constraint);
    RAISE NOTICE 'constraint UNIQUE removida: %', nome_constraint;
  END LOOP;
END $$;

-- 2. Idem para um eventual indice unico avulso (criado fora de constraint).
DO $$
DECLARE
  nome_indice text;
BEGIN
  FOR nome_indice IN
    SELECT idx.relname
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    WHERE ns.nspname = 'public'
      AND tbl.relname = 'ativos'
      AND i.indisunique
      AND NOT i.indisprimary
      AND NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
      AND (
        SELECT array_agg(att.attname)
        FROM unnest(i.indkey) AS k
        JOIN pg_attribute att ON att.attrelid = i.indrelid AND att.attnum = k
      ) = ARRAY['ticker']
  LOOP
    EXECUTE format('DROP INDEX public.%I', nome_indice);
    RAISE NOTICE 'indice unico removido: %', nome_indice;
  END LOOP;
END $$;

-- 3. O indice da UNIQUE servia o ORDER BY ticker das telas. Reposta como
--    indice comum, ja que a unicidade se foi.
CREATE INDEX IF NOT EXISTS idx_ativos_ticker ON public.ativos(ticker);

-- ============================================================
-- Conferencia (deve devolver zero linhas)
-- ============================================================
-- SELECT con.conname
-- FROM pg_constraint con
-- JOIN pg_class rel ON rel.oid = con.conrelid
-- WHERE rel.relname = 'ativos' AND con.contype = 'u';
