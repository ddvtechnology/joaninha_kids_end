/*
  # Fix Authentication Schema Setup

  1. Changes
    - Drop and recreate auth schema with proper configuration
    - Set up auth.users table with correct structure
    - Add necessary indexes and constraints
    - Enable RLS with appropriate policies

  2. Security
    - Enable RLS on auth tables
    - Add proper policies for user access
*/

-- Create auth schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS auth;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing auth.users table if it exists
DROP TABLE IF EXISTS auth.users CASCADE;

-- Create users table with proper structure
CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  instance_id uuid NULL REFERENCES auth.instances(id),
  aud varchar(255) NULL,
  role varchar(255) NULL,
  email varchar(255) UNIQUE,
  encrypted_password varchar(255) NULL,
  email_confirmed_at timestamptz NULL,
  invited_at timestamptz NULL,
  confirmation_token varchar(255) NULL,
  confirmation_sent_at timestamptz NULL,
  recovery_token varchar(255) NULL,
  recovery_sent_at timestamptz NULL,
  email_change_token_new varchar(255) NULL,
  email_change varchar(255) NULL,
  email_change_sent_at timestamptz NULL,
  last_sign_in_at timestamptz NULL,
  raw_app_meta_data jsonb NULL,
  raw_user_meta_data jsonb NULL,
  is_super_admin bool NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now(),
  phone text NULL UNIQUE,
  phone_confirmed_at timestamptz NULL,
  phone_change text NULL DEFAULT '',
  phone_change_token varchar(255) NULL DEFAULT '',
  phone_change_sent_at timestamptz NULL,
  confirmed_at timestamptz NULL GENERATED ALWAYS AS (
    LEAST(email_confirmed_at, phone_confirmed_at)
  ) STORED,
  email_change_token_current varchar(255) NULL DEFAULT '',
  email_change_confirm_status smallint NULL DEFAULT 0,
  banned_until timestamptz NULL,
  reauthentication_token varchar(255) NULL DEFAULT '',
  reauthentication_sent_at timestamptz NULL,
  is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz NULL
);

-- Create necessary indexes
CREATE INDEX users_instance_id_email_idx ON auth.users (instance_id, email);
CREATE INDEX users_instance_id_idx ON auth.users (instance_id);

-- Enable RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own user data." ON auth.users FOR SELECT
USING (auth.uid() = id);

-- Create function to handle password encryption
CREATE OR REPLACE FUNCTION auth.encrypt_password()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.encrypted_password <> OLD.encrypted_password THEN
    NEW.encrypted_password = crypt(NEW.encrypted_password, gen_salt('bf'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for password encryption
DROP TRIGGER IF EXISTS encrypt_password ON auth.users;
CREATE TRIGGER encrypt_password
  BEFORE INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.encrypt_password();

-- Create auth.instances table if it doesn't exist
CREATE TABLE IF NOT EXISTS auth.instances (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  uuid uuid NULL,
  raw_base_config text NULL,
  created_at timestamptz NULL DEFAULT now(),
  updated_at timestamptz NULL DEFAULT now()
);

-- Add comment to explain usage
COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';