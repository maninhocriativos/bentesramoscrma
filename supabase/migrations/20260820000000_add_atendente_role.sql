-- Adiciona o cargo 'Atendente' ao enum app_role e concede acesso a leads_juridicos,
-- seguindo o mesmo padrão de acesso já dado à Secretaria.
-- ALTER TYPE não pode rodar dentro de uma transação, mas o Supabase aceita assim.
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Atendente';
