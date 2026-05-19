-- Adiciona o valor 'Estagiário' ao enum app_role
-- ALTER TYPE não pode rodar dentro de uma transação no Postgres, mas o Supabase aceita assim
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'Estagiário';
