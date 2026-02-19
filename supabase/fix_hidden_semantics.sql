-- Opcional: use apenas se seus produtos ATIVOS estavam com hidden = true no banco.
-- Este script inverte o campo hidden para bater com a nova convenção:
--   hidden = false → produto visível (lista de produtos e vendas)
--   hidden = true  → produto oculto/encerrado (soft delete)
-- Execute no SQL Editor do Supabase se após a correção do app os produtos sumirem.

-- UPDATE products SET hidden = NOT hidden;
