INSERT INTO petition_types (slug, title, description, icon, enabled)
VALUES 
  ('seguro_nao_contratado', 'Seguro Não Contratado', 'Ação declaratória de inexistência de débito por seguro não contratado', 'ShoppingCart', true),
  ('tarifa_bancaria', 'Tarifa Bancária', 'Ação de repetição de indébito por cobrança indevida de tarifas bancárias', 'CreditCard', true),
  ('cancelamento_voo', 'Cancelamento de Voo', 'Ação de reparação por danos morais por cancelamento ou atraso de voo', 'AlertTriangle', true),
  ('emprestimo_fraudulento', 'Empréstimo Fraudulento', 'Ação declaratória de inexistência de débito por empréstimo consignado fraudulento', 'Ban', true),
  ('renovacao_emprestimo', 'Renovação de Empréstimo Fraudulento', 'Ação contra renovação não autorizada de empréstimo consignado', 'TrendingUp', true)
ON CONFLICT (slug) DO NOTHING;