/*
  # Adiciona rastreamento de usuários nas operações

  1. Alterações
    - Adiciona campos para rastrear usuário que criou/modificou registros
    - Atualiza triggers para registrar usuário nas operações

  2. Notas
    - Mantém histórico de quem realizou cada operação
    - Usa e-mail do usuário para identificação
*/

-- Adicionar campos de rastreamento em produtos
ALTER TABLE products
ADD COLUMN created_by text,
ADD COLUMN updated_by text;

-- Adicionar campos de rastreamento em financial_transactions
ALTER TABLE financial_transactions
ADD COLUMN created_by text;

-- Adicionar campos de rastreamento em sales
ALTER TABLE sales
ADD COLUMN created_by text;

-- Atualizar função de registro de transação para incluir usuário
CREATE OR REPLACE FUNCTION register_sale_transaction()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO financial_transactions (
    type,
    description,
    amount,
    category,
    created_by
  )
  VALUES (
    'ENTRADA',
    'Venda #' || NEW.id,
    NEW.total_amount,
    'VENDAS',
    NEW.created_by
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;