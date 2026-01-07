-- 1. Deletar compromissos duplicados (mantém o mais antigo de cada data/hora por lead)
DELETE FROM compromissos 
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY lead_id, data_inicio ORDER BY created_at ASC) as rn
    FROM compromissos 
    WHERE lead_id IS NOT NULL
  ) t 
  WHERE rn > 1
);

-- 2. Criar índice único para prevenir duplicados futuros (mesmo lead + mesma data/hora)
CREATE UNIQUE INDEX IF NOT EXISTS idx_compromissos_lead_data_unico 
ON compromissos (lead_id, data_inicio) 
WHERE lead_id IS NOT NULL;