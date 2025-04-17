/*
  # Adiciona sistema de transações financeiras

  1. Novas Tabelas
    - `financial_transactions`
      - Registra todas as entradas e saídas financeiras
      - Inclui categorização e tipo de transação
      - Mantém histórico completo para relatórios

  2. Segurança
    - Habilita RLS na nova tabela
    - Adiciona políticas para controle de acesso
*/

CREATE TYPE transaction_type AS ENUM ('ENTRADA', 'SAIDA');

CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  description text NOT NULL,
  amount decimal(10,2) NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários autenticados podem ler transações"
  ON financial_transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar transações"
  ON financial_transactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Trigger para registrar venda como transação financeira
CREATE OR REPLACE FUNCTION register_sale_transaction()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO financial_transactions (type, description, amount, category)
  VALUES ('ENTRADA', 'Venda #' || NEW.id, NEW.total_amount, 'VENDAS');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER register_sale_transaction_trigger
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION register_sale_transaction();