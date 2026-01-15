-- Adicionar tipo "Vendas Casadas" na tabela petition_types
INSERT INTO public.petition_types (slug, title, description, icon, enabled)
VALUES (
  'vendas_casadas',
  'Vendas Casadas',
  'Ação contra venda de produtos ou serviços condicionados a outro',
  'Package',
  true
)
ON CONFLICT (slug) DO NOTHING;