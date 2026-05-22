-- Cria a tag "Em Atendimento" usada pelo auto-tag do chat de atendimento
-- is_system = true para indicar que é gerenciada pelo sistema (não aparece na lista de remoção manual)
INSERT INTO chat_tags (name, color, category, is_system, requires_reason)
VALUES ('Em Atendimento', 'amber', 'status', true, false)
ON CONFLICT (name) DO UPDATE
  SET color    = EXCLUDED.color,
      category = EXCLUDED.category,
      is_system = EXCLUDED.is_system;
