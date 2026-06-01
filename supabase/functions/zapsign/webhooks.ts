import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const webhookSecret = Deno.env.get('ZAPSIGN_WEBHOOK_SECRET') || '';

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Processar webhook da Zapsign
 */
export async function handleZapsignWebhook(
  payload: any,
  signature: string | null
): Promise<void> {
  // Validar assinatura HMAC (implementar depois)
  // if (!validateSignature(payload, signature)) {
  //   throw new Error('Invalid webhook signature');
  // }

  const event = payload.event;
  const documentId = payload.document_id;

  console.log(`Processing Zapsign webhook: ${event} for document ${documentId}`);

  switch (event) {
    case 'document.signed':
      await handleDocumentSigned(documentId, payload);
      break;

    case 'document.rejected':
      await handleDocumentRejected(documentId, payload);
      break;

    case 'document.expired':
      await handleDocumentExpired(documentId, payload);
      break;

    case 'document.cancelled':
      await handleDocumentCancelled(documentId, payload);
      break;

    case 'signer.signed':
      await handleSignerSigned(documentId, payload);
      break;

    case 'signer.rejected':
      await handleSignerRejected(documentId, payload);
      break;

    default:
      console.log(`Ignoring event: ${event}`);
  }
}

/**
 * Quando documento é totalmente assinado
 */
async function handleDocumentSigned(documentId: string, payload: any): Promise<void> {
  const { error } = await supabase
    .from('contract_reminders_zapsign')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
    })
    .eq('document_id', documentId);

  if (error) throw error;

  // Atualizar lead
  const { data: contract } = await supabase
    .from('contract_reminders_zapsign')
    .select('lead_id')
    .eq('document_id', documentId)
    .single();

  if (contract?.lead_id) {
    await updateLeadStatus(contract.lead_id, 'Contrato Assinado');
  }

  console.log(`Document ${documentId} signed`);
}

/**
 * Quando documento é rejeitado
 */
async function handleDocumentRejected(documentId: string, payload: any): Promise<void> {
  const { error } = await supabase
    .from('contract_reminders_zapsign')
    .update({
      status: 'rejected',
    })
    .eq('document_id', documentId);

  if (error) throw error;

  console.log(`Document ${documentId} rejected`);
}

/**
 * Quando documento expira
 */
async function handleDocumentExpired(documentId: string, payload: any): Promise<void> {
  const { error } = await supabase
    .from('contract_reminders_zapsign')
    .update({
      status: 'expired',
    })
    .eq('document_id', documentId);

  if (error) throw error;

  console.log(`Document ${documentId} expired`);
}

/**
 * Quando documento é cancelado
 */
async function handleDocumentCancelled(documentId: string, payload: any): Promise<void> {
  const { error } = await supabase
    .from('contract_reminders_zapsign')
    .update({
      status: 'cancelled',
    })
    .eq('document_id', documentId);

  if (error) throw error;

  console.log(`Document ${documentId} cancelled`);
}

/**
 * Quando um signatário assina (pode ser antes de todos assinarem)
 */
async function handleSignerSigned(documentId: string, payload: any): Promise<void> {
  const signerId = payload.signer_id;

  const { error } = await supabase
    .from('contract_reminders_zapsign')
    .update({
      status: 'signed', // Em um cenário real, seria "assinatura_parcial"
      signed_at: new Date().toISOString(),
    })
    .eq('document_id', documentId);

  if (error) throw error;

  console.log(`Signer ${signerId} signed document ${documentId}`);
}

/**
 * Quando um signatário rejeita
 */
async function handleSignerRejected(documentId: string, payload: any): Promise<void> {
  const signerId = payload.signer_id;

  const { error } = await supabase
    .from('contract_reminders_zapsign')
    .update({
      status: 'rejected',
    })
    .eq('document_id', documentId);

  if (error) throw error;

  console.log(`Signer ${signerId} rejected document ${documentId}`);
}

/**
 * Atualizar status do lead
 */
async function updateLeadStatus(leadId: string, newStatus: string): Promise<void> {
  const { error } = await supabase
    .from('leads_juridicos')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  if (error) {
    console.error(`Failed to update lead ${leadId}:`, error);
  } else {
    console.log(`Lead ${leadId} updated to status: ${newStatus}`);
  }
}

/**
 * Validar assinatura HMAC (implementar com secret)
 */
function validateSignature(payload: any, signature: string | null): boolean {
  // TODO: Implementar validação HMAC com ZAPSIGN_WEBHOOK_SECRET
  // Se não tiver secret configurado, aceitar todos os webhooks
  if (!webhookSecret) {
    console.warn('ZAPSIGN_WEBHOOK_SECRET not configured, skipping signature validation');
    return true;
  }

  if (!signature) {
    console.error('Webhook signature missing');
    return false;
  }

  // Implementar HMAC-SHA256 validation aqui
  // const expectedSignature = createHMAC('sha256', webhookSecret).update(JSON.stringify(payload)).digest('hex');
  // return signature === expectedSignature;

  return true;
}
