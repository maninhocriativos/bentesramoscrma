-- Backfill: preenche lead_state, contract_signed_at e state_updated_at
-- para todos os leads que já têm status de contrato assinado mas sem esses campos.
-- Usa updated_at como melhor proxy da data real de assinatura.

UPDATE leads_juridicos
SET
  lead_state         = 'CONTRACT_SIGNED',
  contract_signed_at = COALESCE(contract_signed_at, state_updated_at, updated_at, created_at),
  state_updated_at   = COALESCE(state_updated_at, updated_at, created_at)
WHERE
  (status = 'Contrato Assinado' OR status = 'Ganho')
  AND (lead_state IS NULL OR lead_state != 'CONTRACT_SIGNED');
