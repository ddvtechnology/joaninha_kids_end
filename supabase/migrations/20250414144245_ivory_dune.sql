/*
  # Setup User Profiles Table
  
  1. New Table
    - user_profiles: Links to Supabase auth.users
    - Stores display name and timestamps
    
  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Drop existing table if exists
DROP TABLE IF EXISTS public.user_profiles;

-- Create user_profiles table that extends auth.users
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read their own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Add helpful comment
COMMENT ON TABLE public.user_profiles IS 'Profile information for authenticated users';