-- Corrige total_valor_causa no dashboard:
-- Passa a somar valor_causa da tabela processos (processos ativos) em vez de leads_juridicos.
-- O valor de causa oficial é o cadastrado no módulo de processos, não no lead.

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_leads', (SELECT COUNT(*) FROM leads_juridicos),
    'total_processos', (SELECT COUNT(*) FROM processos),
    'total_valor_causa', (
      SELECT COALESCE(SUM(valor_causa), 0)
      FROM processos
      WHERE status NOT IN ('Arquivado', 'Perdido')
        AND valor_causa IS NOT NULL
    ),
    'leads_hoje', (SELECT COUNT(*) FROM leads_juridicos WHERE created_at >= CURRENT_DATE),
    'leads_novos', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state IS NULL OR lead_state = 'NEW'),
    'leads_em_progresso', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state IN ('TRIAGE', 'CLASSIFIED', 'DATA_CAPTURE', 'CONTRACT_SENT')),
    'leads_convertidos', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state IN ('CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER')),
    'leads_perdidos', (SELECT COUNT(*) FROM leads_juridicos WHERE is_lost = true),
    'leads_ready', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state = 'READY_FOR_LAWYER'),

    'leads_trafego', (
      SELECT COUNT(*) FROM leads_juridicos
      WHERE tipo_origem = 'trafego' OR origem = 'Tráfego Pago'
    ),
    'leads_trafego_convertidos', (
      SELECT COUNT(*) FROM leads_juridicos
      WHERE (tipo_origem = 'trafego' OR origem = 'Tráfego Pago')
        AND lead_state IN ('CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER')
    ),

    'contratos_trafego_total', (
      SELECT COALESCE(SUM(1 + COALESCE(contratos_adicionais, 0)), 0)
      FROM leads_juridicos
      WHERE (tipo_origem = 'trafego' OR origem = 'Tráfego Pago')
        AND lead_state = 'CONTRACT_SIGNED'
    ),

    'contratos_trafego_manual', (
      SELECT COUNT(*)
      FROM contratos_fechados cf
      WHERE EXISTS (
        SELECT 1 FROM leads_juridicos l
        WHERE l.id = cf.lead_id
          AND (l.tipo_origem = 'trafego' OR l.origem = 'Tráfego Pago')
      )
    ),

    'leads_por_origem', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(origem, 'Desconhecida'), cnt), '{}'::jsonb)
      FROM (SELECT origem, COUNT(*) AS cnt FROM leads_juridicos GROUP BY origem) sub
    ),
    'leads_por_status', (
      SELECT COALESCE(jsonb_object_agg(COALESCE(status, 'Novo'), cnt), '{}'::jsonb)
      FROM (SELECT status, COUNT(*) AS cnt FROM leads_juridicos GROUP BY status) sub
    )
  );
$$;
