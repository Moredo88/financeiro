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
--    attname e do tipo `name`, nao `text` — sem o cast, a comparacao com
--    ARRAY['ticker'] falha com "operator does not exist: name[] = text[]".
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
        SELECT array_agg(att.attname::text)
        FROM unnest(con.conkey) AS k
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k
      ) = ARRAY['ticker']
  LOOP
    EXECUTE format('ALTER TABLE public.ativos DROP CONSTRAINT %I', nome_constraint);
    RAISE NOTICE 'constraint UNIQUE removida: %', nome_constraint;
  END LOOP;
END $$;

-- 2. O indice da UNIQUE servia o ORDER BY ticker das telas. Reposto como
--    indice comum, ja que a unicidade se foi.
CREATE INDEX IF NOT EXISTS idx_ativos_ticker ON public.ativos(ticker);

-- ============================================================
-- Conferencia (deve devolver zero linhas)
-- ============================================================
-- SELECT con.conname, pg_get_constraintdef(con.oid)
-- FROM pg_constraint con
-- WHERE con.conrelid = 'public.ativos'::regclass AND con.contype = 'u';
