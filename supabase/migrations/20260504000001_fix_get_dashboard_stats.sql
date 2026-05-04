-- Corrige get_dashboard_stats:
-- 1. Adiciona contratos_trafego_total e contratos_trafego_manual (ausentes na versão anterior)
-- 2. Detecta tráfego por tipo_origem='trafego' OU origem='Tráfego Pago'
-- 3. contratos_trafego_total = soma de contratos efetivos (inclui contratos_adicionais)
-- 4. contratos_trafego_manual = rows em contratos_fechados vinculados a leads de tráfego

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
    'total_valor_causa', (SELECT COALESCE(SUM(valor_causa), 0) FROM leads_juridicos),
    'leads_hoje', (SELECT COUNT(*) FROM leads_juridicos WHERE created_at >= CURRENT_DATE),
    'leads_novos', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state IS NULL OR lead_state = 'NEW'),
    'leads_em_progresso', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state IN ('TRIAGE', 'CLASSIFIED', 'DATA_CAPTURE', 'CONTRACT_SENT')),
    'leads_convertidos', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state IN ('CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER')),
    'leads_perdidos', (SELECT COUNT(*) FROM leads_juridicos WHERE is_lost = true),
    'leads_ready', (SELECT COUNT(*) FROM leads_juridicos WHERE lead_state = 'READY_FOR_LAWYER'),

    -- Tráfego: tipo_origem='trafego' OU origem='Tráfego Pago'
    'leads_trafego', (
      SELECT COUNT(*) FROM leads_juridicos
      WHERE tipo_origem = 'trafego' OR origem = 'Tráfego Pago'
    ),
    'leads_trafego_convertidos', (
      SELECT COUNT(*) FROM leads_juridicos
      WHERE (tipo_origem = 'trafego' OR origem = 'Tráfego Pago')
        AND lead_state IN ('CONTRACT_SIGNED', 'DOCS_PENDING', 'READY_FOR_LAWYER')
    ),

    -- Total de contratos assinados de tráfego (cada contrato_adicional conta)
    'contratos_trafego_total', (
      SELECT COALESCE(SUM(1 + COALESCE(contratos_adicionais, 0)), 0)
      FROM leads_juridicos
      WHERE (tipo_origem = 'trafego' OR origem = 'Tráfego Pago')
        AND lead_state = 'CONTRACT_SIGNED'
    ),

    -- Contratos registrados manualmente (via chat / ContratoFechadoModal) de leads de tráfego
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
