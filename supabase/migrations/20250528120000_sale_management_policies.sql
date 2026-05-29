-- Políticas para gerenciamento de vendas (editar / excluir / estornar)

CREATE POLICY "Enable update for authenticated users"
  ON sales FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
  ON sales FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Enable update for authenticated users"
  ON sale_items FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users"
  ON sale_items FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Enable delete for authenticated users"
  ON financial_transactions FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Enable update for authenticated users"
  ON financial_transactions FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
