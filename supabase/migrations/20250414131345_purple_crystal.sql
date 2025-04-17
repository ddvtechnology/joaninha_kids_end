/*
  # Complete Database Schema Setup
  
  1. Tables
    - users (auth schema)
    - user_profiles
    - products
    - customers
    - sales
    - sale_items
    - financial_transactions
    - expenses
  
  2. Security
    - RLS enabled on all tables
    - Appropriate policies for each table
    
  3. Functions & Triggers
    - Update stock after sale
    - Register financial transactions
    - Update customer points
*/

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create users table
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category product_category NOT NULL,
  description text,
  sale_price numeric(10,2) NOT NULL,
  stock_quantity integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by text,
  updated_by text,
  brand text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  total_points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES customers(id),
  total_amount numeric(10,2) NOT NULL,
  payment_method payment_method NOT NULL,
  points integer DEFAULT 0,
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES sales(id),
  product_id uuid REFERENCES products(id),
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  total_price numeric(10,2) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type transaction_type NOT NULL,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by text
);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  category text NOT NULL,
  date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
DO $$ 
BEGIN
  -- User Profiles Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' AND policyname = 'Users can read their own profile'
  ) THEN
    CREATE POLICY "Users can read their own profile"
      ON user_profiles FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
      ON user_profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
      ON user_profiles FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;

  -- Products Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Authenticated users can read products'
  ) THEN
    CREATE POLICY "Authenticated users can read products"
      ON products FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'products' AND policyname = 'Authenticated users can modify products'
  ) THEN
    CREATE POLICY "Authenticated users can modify products"
      ON products FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Customers Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Authenticated users can read customers'
  ) THEN
    CREATE POLICY "Authenticated users can read customers"
      ON customers FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'customers' AND policyname = 'Authenticated users can modify customers'
  ) THEN
    CREATE POLICY "Authenticated users can modify customers"
      ON customers FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Sales Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Authenticated users can read sales'
  ) THEN
    CREATE POLICY "Authenticated users can read sales"
      ON sales FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sales' AND policyname = 'Authenticated users can create sales'
  ) THEN
    CREATE POLICY "Authenticated users can create sales"
      ON sales FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Sale Items Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sale_items' AND policyname = 'Authenticated users can read sale items'
  ) THEN
    CREATE POLICY "Authenticated users can read sale items"
      ON sale_items FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'sale_items' AND policyname = 'Authenticated users can create sale items'
  ) THEN
    CREATE POLICY "Authenticated users can create sale items"
      ON sale_items FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Financial Transactions Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'financial_transactions' AND policyname = 'Authenticated users can read transactions'
  ) THEN
    CREATE POLICY "Authenticated users can read transactions"
      ON financial_transactions FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'financial_transactions' AND policyname = 'Authenticated users can create transactions'
  ) THEN
    CREATE POLICY "Authenticated users can create transactions"
      ON financial_transactions FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  -- Expenses Policies
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'expenses' AND policyname = 'Authenticated users can read expenses'
  ) THEN
    CREATE POLICY "Authenticated users can read expenses"
      ON expenses FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'expenses' AND policyname = 'Authenticated users can modify expenses'
  ) THEN
    CREATE POLICY "Authenticated users can modify expenses"
      ON expenses FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Functions and Triggers

-- Update stock after sale
CREATE OR REPLACE FUNCTION update_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE products
  SET 
    stock_quantity = stock_quantity - NEW.quantity,
    updated_at = now()
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stock_trigger ON sale_items;
CREATE TRIGGER update_stock_trigger
AFTER INSERT ON sale_items
FOR EACH ROW
EXECUTE FUNCTION update_stock_after_sale();

-- Register sale as financial transaction
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

DROP TRIGGER IF EXISTS register_sale_transaction_trigger ON sales;
CREATE TRIGGER register_sale_transaction_trigger
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION register_sale_transaction();

-- Update customer points
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

DROP TRIGGER IF EXISTS update_customer_points_trigger ON sales;
CREATE TRIGGER update_customer_points_trigger
AFTER INSERT ON sales
FOR EACH ROW
EXECUTE FUNCTION update_customer_points();