/*
  # Simplify User Profiles Schema
  
  1. Changes
    - Remove and recreate user_profiles table in public schema
    - Simplify structure to work with Supabase Auth
    
  2. Security
    - Enable RLS
    - Add proper policies for authenticated users
*/

-- Drop existing table if exists
DROP TABLE IF EXISTS public.user_profiles CASCADE;

-- Create simplified user_profiles table
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL,
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Enable read access for authenticated users"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Enable insert access for authenticated users"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Enable update access for authenticated users"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add helpful comment
COMMENT ON TABLE public.user_profiles IS 'Public profiles for each user';