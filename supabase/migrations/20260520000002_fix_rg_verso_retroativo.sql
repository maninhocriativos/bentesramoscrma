-- Fecha rg_verso para todos os leads que já têm cpf + rg_frente recebidos
-- mas rg_verso ainda está pendente (correção retroativa do bug da ISA)
INSERT INTO public.lead_docs_checklist (lead_id, doc_type, doc_label, is_required, received, received_at, notes, updated_at)
SELECT
  cpf_doc.lead_id,
  'rg_verso',
  'RG - verso (dispensado: CPF recebido)',
  true,
  true,
  NOW(),
  'Auto: CPF + RG frente já recebidos — verso dispensado (fix retroativo)',
  NOW()
FROM public.lead_docs_checklist cpf_doc
INNER JOIN public.lead_docs_checklist rg_frente_doc
  ON rg_frente_doc.lead_id = cpf_doc.lead_id
  AND rg_frente_doc.doc_type = 'rg_frente'
  AND rg_frente_doc.received = true
WHERE cpf_doc.doc_type = 'cpf'
  AND cpf_doc.received = true
  AND NOT EXISTS (
    SELECT 1 FROM public.lead_docs_checklist verso
    WHERE verso.lead_id = cpf_doc.lead_id
      AND verso.doc_type = 'rg_verso'
      AND verso.received = true
  )
ON CONFLICT (lead_id, doc_type)
DO UPDATE SET
  received    = true,
  received_at = COALESCE(lead_docs_checklist.received_at, NOW()),
  notes       = 'Auto: CPF + RG frente já recebidos — verso dispensado (fix retroativo)',
  updated_at  = NOW();
