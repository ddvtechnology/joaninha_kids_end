-- Remover trigger on_auth_user_created da tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Remover função handle_new_user
DROP FUNCTION IF EXISTS public.handle_new_user();
