/*
  # Adiciona tabela de perfis de usuário e ajustes no sistema

  1. Novas Tabelas
    - `user_profiles`: Armazena informações adicionais dos usuários
      - `user_id` (uuid, chave primária)
      - `display_name` (nome de exibição)
      - `created_at` (data de criação)
      - `updated_at` (data de atualização)

  2. Segurança
    - RLS habilitado na tabela
    - Políticas para controle de acesso
*/

-- Criar tabela de perfis de usuário
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  display_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Usuários podem ler seus próprios perfis"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar seus próprios perfis"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seus próprios perfis"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);