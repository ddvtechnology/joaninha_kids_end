/*
  # Simplify Authentication Schema
  
  1. Remove all custom auth tables and constraints
  2. Keep only essential business tables
  3. Use simple UUID references to auth.users
*/

-- Drop all existing tables and types
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP TABLE IF EXISTS public.financial_transactions CASCADE;
DROP TABLE IF EXISTS public.sale_items CASCADE;
DROP TABLE IF EXISTS public.sales CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.expenses CASCADE;

DROP TYPE IF EXISTS public.product_category CASCADE;
DROP TYPE IF EXISTS public.payment_method CASCADE;
DROP TYPE IF EXISTS public.transaction_type CASCADE;

-- Create enums
CREATE TYPE product_category AS ENUM (
  'VESTIDOS',
  'CONJUNTOS',
  'MACACAO',
  'CALCADOS',
  'ACESSORIOS',
  'BODIES',
  'PIJAMAS',
  'CASACOS',
  'OUTROS'
);

CREATE TYPE payment_method AS ENUM (
  'PIX',
  'DINHEIRO',
  'CARTAO_DEBITO',
  'CARTAO_CREDITO'
);

CREATE TYPE transaction_type AS ENUM (
  'ENTRADA',
  'SAIDA'
);

-- Create tables with minimal auth references
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category product_category NOT NULL,
  description text,
  sale_price numeric(10,2) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_by uuid
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  total_amount numeric(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE TABLE sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id),
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text NOT NULL,
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create basic policies
CREATE POLICY "Enable read for authenticated users" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON products FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for authenticated users" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON customers FOR ALL TO authenticated USING (true);

CREATE POLICY "Enable read for authenticated users" ON sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON sales FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON sale_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON financial_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON financial_transactions FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable read for authenticated users" ON expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable all for authenticated users" ON expenses FOR ALL TO authenticated USING (true);

-- Create functions and triggers
CREATE OR REPLACE FUNCTION update_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - NEW.quantity
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- Create triggers
CREATE TRIGGER update_stock_trigger
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_stock_after_sale();

CREATE TRIGGER register_sale_transaction_trigger
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION register_sale_transaction();

CREATE TRIGGER update_customer_points_trigger
  AFTER INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_points();