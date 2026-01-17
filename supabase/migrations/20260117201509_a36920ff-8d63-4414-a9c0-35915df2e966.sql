-- Corrigir leads que já estão em atendimento mas ainda com lead_state = NEW
-- Leads com status 'Em Atendimento' que têm conversas = TRIAGE
UPDATE leads_juridicos 
SET lead_state = 'TRIAGE',
    state_updated_at = now()
WHERE lead_state = 'NEW' 
  AND status = 'Em Atendimento';

-- Leads com status 'Em Negociação' = CLASSIFIED
UPDATE leads_juridicos 
SET lead_state = 'CLASSIFIED',
    state_updated_at = now()
WHERE lead_state IS NULL OR lead_state = 'NEW'
  AND status = 'Em Negociação';

-- Leads com status 'Aguardando Contrato' = DATA_CAPTURE
UPDATE leads_juridicos 
SET lead_state = 'DATA_CAPTURE',
    state_updated_at = now()
WHERE (lead_state IS NULL OR lead_state = 'NEW')
  AND status = 'Aguardando Contrato';

-- Leads com status 'Contrato Assinado' = CONTRACT_SIGNED
UPDATE leads_juridicos 
SET lead_state = 'CONTRACT_SIGNED',
    state_updated_at = now(),
    contract_signed_at = COALESCE(contract_signed_at, updated_at, now())
WHERE (lead_state IS NULL OR lead_state = 'NEW')
  AND status = 'Contrato Assinado';

-- Leads com status 'Ganho' = READY_FOR_LAWYER
UPDATE leads_juridicos 
SET lead_state = 'READY_FOR_LAWYER',
    state_updated_at = now()
WHERE (lead_state IS NULL OR lead_state = 'NEW')
  AND status = 'Ganho';

-- Leads com status 'Perdido' = marcar como lost
UPDATE leads_juridicos 
SET is_lost = true,
    lost_at = COALESCE(lost_at, updated_at, now()),
    lost_reason = COALESCE(lost_reason, 'Status migrado do CRM antigo')
WHERE (lead_state IS NULL OR lead_state = 'NEW')
  AND status = 'Perdido'
  AND is_lost IS NOT TRUE;

-- Registrar todas essas migrações no histórico
INSERT INTO lead_state_history (lead_id, from_state, to_state, changed_by, reason)
SELECT id, 'NEW', lead_state, 'migration-sync-states', 'Sincronização automática do status legado com lead_state'
FROM leads_juridicos
WHERE lead_state IS NOT NULL 
  AND lead_state != 'NEW'
  AND id NOT IN (SELECT lead_id FROM lead_state_history);