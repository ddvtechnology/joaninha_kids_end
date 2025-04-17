/*
  # Adiciona sistema de clientes e pontos

  1. Novas Tabelas
    - `customers`: Cadastro de clientes
      - `id` (uuid, chave primária)
      - `name` (nome do cliente)
      - `phone` (telefone)
      - `total_points` (pontos acumulados)
      - `created_at` (data de cadastro)

  2. Alterações
    - Adiciona referência do cliente na tabela `sales`
    - Adiciona campo de pontos na tabela `sales`

  3. Segurança
    - Habilita RLS na nova tabela
    - Adiciona políticas para controle de acesso
*/

-- Criar tabela de clientes
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Adicionar campos na tabela de vendas
ALTER TABLE sales 
ADD COLUMN customer_id uuid REFERENCES customers(id),
ADD COLUMN points_earned integer DEFAULT 0;

-- Habilitar RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários autenticados podem ler clientes"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem modificar clientes"
  ON customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Função para atualizar pontos do cliente
CREATE OR REPLACE FUNCTION update_customer_points()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    UPDATE customers
    SET total_points = total_points + NEW.points_earned
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar pontos
CREATE TRIGGER update_customer_points_trigger
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION update_customer_points();