/*
  # Fix Authentication Schema Setup
  
  1. Changes
    - Create auth schema with proper extensions
    - Set up auth.users table correctly
    - Add necessary auth functions
    
  2. Security
    - Enable RLS on auth tables
    - Add appropriate policies
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create users table with proper structure
CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email text UNIQUE NOT NULL,
  encrypted_password text NOT NULL,
  last_sign_in_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  role text,
  email_confirmed_at timestamptz,
  phone text,
  phone_confirmed_at timestamptz,
  confirmation_token text,
  recovery_token text,
  email_change_token text,
  email_change text,
  CONSTRAINT proper_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Create function to handle password encryption
CREATE OR REPLACE FUNCTION auth.encrypt_password()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.encrypted_password <> OLD.encrypted_password THEN
    NEW.encrypted_password = crypt(NEW.encrypted_password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for password encryption
DROP TRIGGER IF EXISTS encrypt_password ON auth.users;
CREATE TRIGGER encrypt_password
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.encrypt_password();

-- Create function to get authenticated user ID
CREATE OR REPLACE FUNCTION auth.uid() 
RETURNS uuid AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ LANGUAGE sql STABLE;

-- Create function to check if user is authenticated
CREATE OR REPLACE FUNCTION auth.role() 
RETURNS text AS $$
  SELECT nullif(current_setting('request.jwt.claim.role', true), '')::text;
$$ LANGUAGE sql STABLE;

-- Enable RLS on auth.users
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create policies for auth.users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND schemaname = 'auth' AND policyname = 'Users can read their own data'
  ) THEN
    CREATE POLICY "Users can read their own data" 
      ON auth.users
      FOR SELECT 
      USING (auth.uid() = id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'users' AND schemaname = 'auth' AND policyname = 'Users can update their own data'
  ) THEN
    CREATE POLICY "Users can update their own data" 
      ON auth.users
      FOR UPDATE 
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;