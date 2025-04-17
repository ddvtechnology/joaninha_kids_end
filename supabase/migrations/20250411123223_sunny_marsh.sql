/*
  # Criação das tabelas iniciais

  1. Novas Tabelas
    - `products`: Armazena informações dos produtos
    - `sales`: Registra as vendas
    - `sale_items`: Itens de cada venda

  2. Segurança
    - RLS habilitado em todas as tabelas
    - Políticas para controle de acesso
*/

-- Criar enum para categorias de produtos
CREATE TYPE product_category AS ENUM (
  'VESTIDOS',
  'CONJUNTOS',
  'MACACAO',
  'CALCADOS',
  'ACESSORIOS',
  'BODIES',
  'PIJAMAS',
  'CASACOS'
);

-- Criar enum para métodos de pagamento
CREATE TYPE payment_method AS ENUM (
  'PIX',
  'DINHEIRO',
  'CARTAO_DEBITO',
  'CARTAO_CREDITO'
);

-- Tabela de produtos
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category product_category NOT NULL,
  description text,
  image_url text,
  sale_price decimal(10,2) NOT NULL,
  cost_price decimal(10,2) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de vendas
CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  total_amount decimal(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela de itens da venda
CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id),
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price decimal(10,2) NOT NULL,
  total_price decimal(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários autenticados podem ler produtos"
  ON products FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem modificar produtos"
  ON products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler vendas"
  ON sales FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar vendas"
  ON sales FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuários autenticados podem ler itens de venda"
  ON sale_items FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autenticados podem criar itens de venda"
  ON sale_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Função para atualizar o estoque após uma venda
CREATE OR REPLACE FUNCTION update_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar estoque
CREATE TRIGGER update_stock_trigger
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_sale();