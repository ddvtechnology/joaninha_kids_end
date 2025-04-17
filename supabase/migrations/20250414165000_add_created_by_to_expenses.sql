-- Migração para adicionar a coluna created_by na tabela expenses

ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS created_by text;

-- Opcional: adicionar índice para melhorar performance em consultas filtrando por created_by
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON expenses(created_by);
