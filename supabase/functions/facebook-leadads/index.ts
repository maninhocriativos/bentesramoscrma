import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Facebook Webhook Verification Token (você define isso no Meta)
const VERIFY_TOKEN = Deno.env.get('FB_LEADADS_VERIFY_TOKEN') || 'bentes_ramos_crm_2024';

// Normalizar telefone para formato brasileiro
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 0) return null;
  
  // Remover prefixo "p:" se existir
  if (cleaned.startsWith('p')) {
    cleaned = cleaned.substring(1);
  }
  
  // Adicionar código do Brasil se necessário
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = '55' + cleaned;
  }
  
  return cleaned;
}

serve(async (req) => {
  const url = new URL(req.url);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ========================================
    // GET: Facebook Webhook Verification
    // ========================================
    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');

      console.log('[FB Lead Ads] Verification request:', { mode, token, challenge });

      if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('[FB Lead Ads] ✅ Webhook verified successfully');
        return new Response(challenge, { 
          status: 200,
          headers: { 'Content-Type': 'text/plain' }
        });
      } else {
        console.error('[FB Lead Ads] ❌ Verification failed - token mismatch');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // ========================================
    // POST: Receive Lead from Facebook OR Sync Request
    // ========================================
    if (req.method === 'POST') {
      const payload = await req.json();
      
      // ========================================
      // ROTA DE SINCRONIZAÇÃO MANUAL
      // Permite sincronizar leads do FB Lead Ads com CRM
      // Envie: { action: 'sync', leads: [{ nome, email, telefone }] }
      // ========================================
      if (payload.action === 'sync' && Array.isArray(payload.leads)) {
        console.log('[FB Lead Ads] 🔄 Manual sync request for', payload.leads.length, 'leads');
        
        const results = [];
        
        for (const fbLead of payload.leads) {
          const nome = fbLead.nome || fbLead.name || fbLead.nome_completo || fbLead.full_name;
          const email = fbLead.email?.toLowerCase();
          const telefoneRaw = fbLead.telefone || fbLead.phone;
          const telefone = normalizePhone(telefoneRaw);
          
          if (!nome && !email && !telefone) {
            results.push({ success: false, error: 'Nenhum dado fornecido' });
            continue;
          }
          
          console.log('[FB Lead Ads] Processing:', { nome, email, telefone });
          
          // Buscar lead existente por telefone
          let leadId: string | null = null;
          let matchedBy: string | null = null;
          
          if (telefone) {
            const phoneSuffix = telefone.slice(-9);
            const { data: leadByPhone } = await supabase
              .from('leads_juridicos')
              .select('id, email, nome')
              .ilike('telefone', `%${phoneSuffix}%`)
              .maybeSingle();
            
            if (leadByPhone) {
              leadId = leadByPhone.id;
              matchedBy = 'telefone';
              
              // Atualizar email se não existir
              if (email && !leadByPhone.email) {
                await supabase
                  .from('leads_juridicos')
                  .update({ 
                    email: email,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', leadId);
                console.log('[FB Lead Ads] ✅ Updated lead with email:', email);
              }
              
              // Atualizar nome se genérico
              if (nome && leadByPhone.nome && (
                leadByPhone.nome.startsWith('Contato') || 
                leadByPhone.nome === 'Desconhecido' ||
                /^\d+$/.test(leadByPhone.nome)
              )) {
                await supabase
                  .from('leads_juridicos')
                  .update({ 
                    nome: nome,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', leadId);
                console.log('[FB Lead Ads] ✅ Updated lead with name:', nome);
              }
            }
          }
          
          // Buscar por email se não encontrou por telefone
          if (!leadId && email) {
            const { data: leadByEmail } = await supabase
              .from('leads_juridicos')
              .select('id')
              .eq('email', email)
              .maybeSingle();
            
            if (leadByEmail) {
              leadId = leadByEmail.id;
              matchedBy = 'email';
              
              // Atualizar telefone se não existir
              if (telefone) {
                const { data: currentLead } = await supabase
                  .from('leads_juridicos')
                  .select('telefone')
                  .eq('id', leadId)
                  .single();
                
                if (!currentLead?.telefone) {
                  await supabase
                    .from('leads_juridicos')
                    .update({ 
                      telefone: telefone,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', leadId);
                }
              }
            }
          }
          
          // Buscar por nome (match parcial)
          if (!leadId && nome) {
            const { data: leadByName } = await supabase
              .from('leads_juridicos')
              .select('id, email, telefone')
              .ilike('nome', `%${nome}%`)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            if (leadByName) {
              leadId = leadByName.id;
              matchedBy = 'nome';
              
              // Atualizar dados que faltam
              const updates: any = { updated_at: new Date().toISOString() };
              if (email && !leadByName.email) updates.email = email;
              if (telefone && !leadByName.telefone) updates.telefone = telefone;
              
              if (Object.keys(updates).length > 1) {
                await supabase
                  .from('leads_juridicos')
                  .update(updates)
                  .eq('id', leadId);
              }
            }
          }
          
          // Se não encontrou, criar novo lead
          if (!leadId) {
            const { data: newLead, error: insertError } = await supabase
              .from('leads_juridicos')
              .insert({
                nome: nome || 'Lead Facebook',
                telefone: telefone || null,
                email: email || null,
                status: 'Lead Frio',
                lead_state: 'NEW',
                origem: 'Facebook',
                tipo_origem: 'trafego',
                fonte_trafego: 'facebook_lead_ads',
                canal_origem: 'facebook',
                resumo_ia: `Lead importado do Facebook Lead Ads em ${new Date().toLocaleDateString('pt-BR')}.`
              })
              .select('id')
              .single();
            
            if (insertError) {
              console.error('[FB Lead Ads] Error creating lead:', insertError);
              results.push({ success: false, error: insertError.message, nome });
              continue;
            }
            
            leadId = newLead.id;
            matchedBy = 'created';
            console.log('[FB Lead Ads] ✅ Created new lead:', leadId);
          }
          
          results.push({ 
            success: true, 
            lead_id: leadId, 
            matched_by: matchedBy,
            nome,
            email,
            telefone
          });
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            synced: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            results 
          }),
          { 
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }
      
      // ========================================
      // WEBHOOK PADRÃO DO FACEBOOK LEAD ADS
      // ========================================
      console.log('[FB Lead Ads] 📥 Received webhook:', JSON.stringify(payload, null, 2));

      // Facebook envia um objeto com entry[]
      const entries = payload.entry || [];
      let leadsProcessed = 0;

      for (const entry of entries) {
        const changes = entry.changes || [];
        
        for (const change of changes) {
          if (change.field !== 'leadgen') continue;
          
          const leadgenId = change.value?.leadgen_id;
          const formId = change.value?.form_id;
          const pageId = change.value?.page_id;
          const adId = change.value?.ad_id;
          const adgroupId = change.value?.adgroup_id;
          const createdTime = change.value?.created_time;

          console.log('[FB Lead Ads] Processing lead:', { leadgenId, formId, pageId, adId });

          if (!leadgenId) {
            console.warn('[FB Lead Ads] No leadgen_id found, skipping');
            continue;
          }

          // Para obter os dados do lead, precisamos chamar a Graph API
          // Isso requer o ACCESS_TOKEN configurado
          const accessToken = Deno.env.get('META_ACCESS_TOKEN');
          
          if (!accessToken) {
            console.error('[FB Lead Ads] META_ACCESS_TOKEN not configured');
            
            // Salvar o lead_id para processamento posterior
            await supabase.from('integration_logs').insert({
              provider: 'facebook_leadads',
              direction: 'inbound',
              endpoint: '/facebook-leadads',
              status: 'pending',
              payload_json: {
                leadgen_id: leadgenId,
                form_id: formId,
                page_id: pageId,
                ad_id: adId,
                needs_fetch: true
              }
            });
            
            continue;
          }

          // Buscar dados do lead na Graph API
          const leadResponse = await fetch(
            `https://graph.facebook.com/v20.0/${leadgenId}?access_token=${accessToken}`
          );
          
          if (!leadResponse.ok) {
            const error = await leadResponse.json();
            console.error('[FB Lead Ads] Failed to fetch lead data:', error);
            
            await supabase.from('integration_logs').insert({
              provider: 'facebook_leadads',
              direction: 'inbound',
              endpoint: `graph.facebook.com/${leadgenId}`,
              status: 'error',
              error_message: error.error?.message || 'Failed to fetch lead',
              payload_json: { leadgen_id: leadgenId, form_id: formId }
            });
            
            continue;
          }

          const leadData = await leadResponse.json();
          console.log('[FB Lead Ads] Lead data from Graph API:', leadData);

          // Extrair campos do formulário
          const fieldData = leadData.field_data || [];
          let nome: string | null = null;
          let email: string | null = null;
          let telefone: string | null = null;

          for (const field of fieldData) {
            const fieldName = field.name?.toLowerCase() || '';
            const values = field.values || [];
            const value = values[0] || null;

            if (fieldName.includes('name') || fieldName.includes('nome') || fieldName === 'full_name') {
              nome = value;
            } else if (fieldName.includes('email')) {
              email = value;
            } else if (fieldName.includes('phone') || fieldName.includes('telefone') || fieldName.includes('whatsapp')) {
              telefone = value;
            }
          }

          // Normalizar telefone
          const telefoneNormalizado = normalizePhone(telefone);

          console.log('[FB Lead Ads] Extracted data:', { nome, email, telefone: telefoneNormalizado });

          // Verificar se já existe lead com esse facebook_lead_id
          const { data: existingLead } = await supabase
            .from('leads_juridicos')
            .select('id')
            .eq('facebook_lead_id', leadgenId)
            .maybeSingle();

          if (existingLead) {
            console.log('[FB Lead Ads] Lead already exists:', existingLead.id);
            leadsProcessed++;
            continue;
          }

          // Verificar por telefone ou email
          let leadId: string | null = null;
          
          if (telefoneNormalizado) {
            const phoneSuffix = telefoneNormalizado.slice(-9);
            const { data: leadByPhone } = await supabase
              .from('leads_juridicos')
              .select('id, email, nome')
              .ilike('telefone', `%${phoneSuffix}%`)
              .maybeSingle();
            
            if (leadByPhone) {
              leadId = leadByPhone.id;
              
              // Atualizar com facebook_lead_id e dados faltantes
              const updates: any = {
                facebook_lead_id: leadgenId,
                tipo_origem: 'trafego',
                fonte_trafego: 'facebook_lead_ads',
                updated_at: new Date().toISOString()
              };
              
              if (email && !leadByPhone.email) {
                updates.email = email.toLowerCase();
              }
              
              if (nome && leadByPhone.nome && (
                leadByPhone.nome.startsWith('Contato') || 
                leadByPhone.nome === 'Desconhecido'
              )) {
                updates.nome = nome;
              }
              
              await supabase
                .from('leads_juridicos')
                .update(updates)
                .eq('id', leadId);
              
              console.log('[FB Lead Ads] ✅ Updated existing lead with FB data:', leadId);
            }
          }

          if (!leadId && email) {
            const { data: leadByEmail } = await supabase
              .from('leads_juridicos')
              .select('id')
              .eq('email', email.toLowerCase())
              .maybeSingle();
            
            if (leadByEmail) {
              leadId = leadByEmail.id;
              await supabase
                .from('leads_juridicos')
                .update({ 
                  facebook_lead_id: leadgenId,
                  tipo_origem: 'trafego',
                  fonte_trafego: 'facebook_lead_ads',
                  updated_at: new Date().toISOString()
                })
                .eq('id', leadId);
              
              console.log('[FB Lead Ads] Updated existing lead by email:', leadId);
            }
          }

          // Criar novo lead se não existir
          if (!leadId) {
            const { data: newLead, error: insertError } = await supabase
              .from('leads_juridicos')
              .insert({
                nome: nome || 'Lead Facebook',
                telefone: telefoneNormalizado || null,
                email: email?.toLowerCase() || null,
                facebook_lead_id: leadgenId,
                status: 'Lead Frio',
                lead_state: 'NEW',
                origem: 'Facebook',
                tipo_origem: 'trafego',
                fonte_trafego: 'facebook_lead_ads',
                canal_origem: 'facebook',
                resumo_ia: `Lead captado via Facebook Lead Ads em ${new Date().toLocaleDateString('pt-BR')}. Formulário: ${formId || 'N/A'}.`
              })
              .select('id')
              .single();

            if (insertError) {
              console.error('[FB Lead Ads] Error creating lead:', insertError);
            } else {
              leadId = newLead.id;
              console.log('[FB Lead Ads] ✅ Created new lead:', leadId);
            }
          }

          // Registrar log de sucesso
          await supabase.from('integration_logs').insert({
            provider: 'facebook_leadads',
            direction: 'inbound',
            endpoint: '/facebook-leadads',
            status: 'success',
            lead_id: leadId,
            payload_json: {
              leadgen_id: leadgenId,
              form_id: formId,
              page_id: pageId,
              ad_id: adId,
              nome,
              email,
              telefone: telefoneNormalizado
            },
            response_json: { lead_id: leadId, action: existingLead ? 'updated' : 'created' }
          });

          // Registrar evento no system_events se existir
          try {
            await supabase.from('system_events').insert({
              tipo: 'lead',
              fonte: 'facebook_lead_ads',
              acao: 'lead_created',
              entidade_tipo: 'lead',
              entidade_id: leadId,
              lead_id: leadId,
              dados: {
                leadgen_id: leadgenId,
                form_id: formId,
                ad_id: adId,
                channel: 'facebook',
                nome,
                email,
                telefone: telefoneNormalizado
              }
            });
          } catch (e) {
            // system_events pode não existir
            console.log('[FB Lead Ads] system_events not available');
          }

          leadsProcessed++;
        }
      }

      console.log(`[FB Lead Ads] ✅ Processed ${leadsProcessed} leads`);

      return new Response(
        JSON.stringify({ success: true, leads_processed: leadsProcessed }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('[FB Lead Ads] Error:', error);
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});