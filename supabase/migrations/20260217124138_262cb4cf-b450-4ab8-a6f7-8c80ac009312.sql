
-- 1) Insert 3 NEW leads into leads_juridicos (those without phone match)
INSERT INTO public.leads_juridicos (nome, telefone, email, status, tipo_origem, fonte_trafego, origem, canal_origem, created_at, tipo_acao, owner_tipo, isa_ativa, linha_whatsapp, empresa_tag)
VALUES
  ('ROBSON RICARD TAVARES PIMENTA Pimenta', '5592981054032', 'robsonricard2@gmail.com', 'Lead Frio', 'trafego', 'facebook_lead_ads', 'Tráfego Pago', 'facebook', '2026-02-16T02:45:09-04:00', 'Direito do Consumidor', 'isa', true, 'trafego_isa', 'bentes_ramos'),
  ('Jonas Ferreira de Souza', '5592981435105', 'jonasferreirasouza2002@gmail.com', 'Lead Frio', 'trafego', 'facebook_lead_ads', 'Tráfego Pago', 'facebook', '2026-02-16T02:00:35-04:00', 'Direito do Consumidor', 'isa', true, 'trafego_isa', 'bentes_ramos'),
  ('Eliezer Braga de Andrade', '5592984538331', 'eliezerbragadeandrade@gmail.com', 'Lead Frio', 'trafego', 'facebook_lead_ads', 'Tráfego Pago', 'facebook', '2026-02-15T13:32:56-04:00', 'Direito do Consumidor', 'isa', true, 'trafego_isa', 'bentes_ramos');

-- 2) Update existing leads to ensure correct classification
UPDATE public.leads_juridicos SET tipo_origem = 'trafego', fonte_trafego = 'facebook_lead_ads', origem = 'Tráfego Pago', empresa_tag = COALESCE(empresa_tag, 'bentes_ramos'), nome = 'Priscila Freire de Almeida', email = COALESCE(email, 'priscillaalmeidabenaion@gmail.com') WHERE id = 'c3ed5c73-675b-45a0-a536-2c5499f99fe0';
UPDATE public.leads_juridicos SET tipo_origem = 'trafego', fonte_trafego = 'facebook_lead_ads', origem = 'Tráfego Pago', empresa_tag = COALESCE(empresa_tag, 'bentes_ramos'), nome = 'Raimundo Astrogildo', email = COALESCE(email, 'raimundoastrogildo530@gmail.com') WHERE id = '0c93d262-9e18-4390-9752-bad2eb0049d9';
UPDATE public.leads_juridicos SET tipo_origem = 'trafego', fonte_trafego = 'facebook_lead_ads', origem = 'Tráfego Pago', empresa_tag = COALESCE(empresa_tag, 'bentes_ramos'), nome = 'Raimundo Gomes Martins', email = COALESCE(email, 'gomesmartins771@gmail.com') WHERE id = '3d2835ce-cd29-4e49-8b6e-0ca8dcb53775';
UPDATE public.leads_juridicos SET tipo_origem = 'trafego', fonte_trafego = 'facebook_lead_ads', origem = 'Tráfego Pago', empresa_tag = COALESCE(empresa_tag, 'bentes_ramos'), nome = 'Erculano Gonzaga Rodrigues', email = COALESCE(email, 'paulocatore@hotmail.com') WHERE id = '61e9b41b-b61d-417e-8db8-66fe0b912ae2';

-- 3) Insert meta_form_leads for all 7 (linked to leads_juridicos)
-- Lead 1: Priscila (existing c3ed5c73)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('944081828184073', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-16T18:40:35-04:00', 'Priscila Freire de Almeida', '5592993609854', 'priscillaalmeidabenaion@gmail.com', 'novo', 'c3ed5c73-675b-45a0-a536-2c5499f99fe0', '{"vinculo":"aposentado(a) do inss","valor_emprestimo":"são vários empréstimos","banco":"financeiras externa"}', '{}', '2026-02-16T18:40:35-04:00');

-- Lead 2: Robson (new - need subquery)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('766011589918501', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-16T02:45:09-04:00', 'ROBSON RICARD TAVARES PIMENTA Pimenta', '5592981054032', 'robsonricard2@gmail.com', 'novo', (SELECT id FROM leads_juridicos WHERE telefone = '5592981054032' LIMIT 1), '{"vinculo":"trabalho em empresa privada / autônomo / outros","valor_emprestimo":"6.000","banco":"B. Brasil"}', '{}', '2026-02-16T02:45:09-04:00');

-- Lead 3: Jonas (new)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('1272900245032056', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-16T02:00:35-04:00', 'Jonas Ferreira de Souza', '5592981435105', 'jonasferreirasouza2002@gmail.com', 'novo', (SELECT id FROM leads_juridicos WHERE telefone = '5592981435105' LIMIT 1), '{"vinculo":"aposentado(a) do inss","valor_emprestimo":"1065.00","banco":"Itaú"}', '{}', '2026-02-16T02:00:35-04:00');

-- Lead 4: Raimundo Astrogildo (existing 0c93d262)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('913101351177501', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-15T16:00:28-04:00', 'Raimundo Astrogildo', '5592986085295', 'raimundoastrogildo530@gmail.com', 'novo', '0c93d262-9e18-4390-9752-bad2eb0049d9', '{"vinculo":"aposentado(a) do inss","valor_emprestimo":"876,30","banco":"Agibank"}', '{}', '2026-02-15T16:00:28-04:00');

-- Lead 5: Eliezer (new)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('1204462675184779', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-15T13:32:56-04:00', 'Eliezer Braga de Andrade', '5592984538331', 'eliezerbragadeandrade@gmail.com', 'novo', (SELECT id FROM leads_juridicos WHERE telefone = '5592984538331' LIMIT 1), '{"vinculo":"aposentado(a) do inss","valor_emprestimo":"18.000","banco":"banco 66"}', '{}', '2026-02-15T13:32:56-04:00');

-- Lead 6: Raimundo Gomes (existing 3d2835ce)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('1429963975280587', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-15T12:02:22-04:00', 'Raimundo Gomes Martins', '5592993317830', 'gomesmartins771@gmail.com', 'novo', '3d2835ce-cd29-4e49-8b6e-0ca8dcb53775', '{"vinculo":"servidor público (federal, estadual ou municipal)","valor_emprestimo":"15000","banco":"Bradesco, boa vista do ramos Amazonas, agência maués"}', '{}', '2026-02-15T12:02:22-04:00');

-- Lead 7: Erculano (existing 61e9b41b)
INSERT INTO public.meta_form_leads (meta_lead_id, form_id, ad_id, adset_id, campaign_id, created_time, nome, telefone, email, status, linked_lead_id, form_fields, raw, created_at)
VALUES ('1528241038273179', '806114115222300', '120242294098690450', '120242294098700450', '120242294098680450', '2026-02-15T06:34:11-04:00', 'Erculano Gonzaga Rodrigues', '5592992779984', 'paulocatore@hotmail.com', 'novo', '61e9b41b-b61d-417e-8db8-66fe0b912ae2', '{"vinculo":"aposentado(a) do inss","valor_emprestimo":"R$ 5.000,00","banco":"Bradesco"}', '{}', '2026-02-15T06:34:11-04:00');

-- 4) Create manychat_subscribers for new leads (so chat works)
INSERT INTO public.manychat_subscribers (subscriber_id, nome, telefone, canal, linha_whatsapp, empresa_tag, lead_id)
SELECT 'zapi_5592981054032', 'ROBSON RICARD TAVARES PIMENTA Pimenta', '5592981054032', 'whatsapp', 'trafego_isa', 'bentes_ramos', id FROM leads_juridicos WHERE telefone = '5592981054032' LIMIT 1
ON CONFLICT (subscriber_id) DO NOTHING;

INSERT INTO public.manychat_subscribers (subscriber_id, nome, telefone, canal, linha_whatsapp, empresa_tag, lead_id)
SELECT 'zapi_5592981435105', 'Jonas Ferreira de Souza', '5592981435105', 'whatsapp', 'trafego_isa', 'bentes_ramos', id FROM leads_juridicos WHERE telefone = '5592981435105' LIMIT 1
ON CONFLICT (subscriber_id) DO NOTHING;

INSERT INTO public.manychat_subscribers (subscriber_id, nome, telefone, canal, linha_whatsapp, empresa_tag, lead_id)
SELECT 'zapi_5592984538331', 'Eliezer Braga de Andrade', '5592984538331', 'whatsapp', 'trafego_isa', 'bentes_ramos', id FROM leads_juridicos WHERE telefone = '5592984538331' LIMIT 1
ON CONFLICT (subscriber_id) DO NOTHING;
