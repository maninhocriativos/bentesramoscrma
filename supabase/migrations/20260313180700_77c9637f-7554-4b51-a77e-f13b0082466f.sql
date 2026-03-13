INSERT INTO petition_types (slug, title, description, icon, enabled)
VALUES 
  ('servidor_publico_promocao', 'Promoção de Servidor Público', 'Ação de Obrigação de Fazer c/c Cobrança de Diferença Salarial Retroativa - Promoção de servidor público', 'FileText', true),
  ('diferenca_salarial', 'Diferença Salarial Retroativa', 'Ação de Cobrança de Salário Retroativo - Diferença salarial de servidor público', 'FileText', true),
  ('revisao_contrato_emprestimo', 'Revisão de Contrato de Empréstimo', 'Ação de Revisão de Contrato de Empréstimo c/c Nulidade de Cláusulas Abusivas c/c Repetição de Indébito', 'CreditCard', true)
ON CONFLICT (slug) DO NOTHING;