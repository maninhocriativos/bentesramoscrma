import { supabase } from '@/integrations/supabase/client';

// Marca um lead como Perdido registrando o motivo e um rastro em
// lead_state_history — usado pelos dois caminhos que levam um lead a
// "Perdido" (drag-and-drop no Kanban e o Select de status na aba Editar do
// modal de detalhe). Antes só o botão dedicado do ChatInbox fazia isso
// direito; os outros dois caminhos trocavam status sem deixar nenhum rastro
// na aba Histórico.
export async function marcarLeadPerdido(
  leadId: string, motivo: string, changedBy: string,
): Promise<{ error: Error | null }> {
  const agora = new Date().toISOString();

  const { data: leadAntes } = await supabase
    .from('leads_juridicos')
    .select('lead_state')
    .eq('id', leadId)
    .single();

  const { error } = await supabase
    .from('leads_juridicos')
    .update({
      status: 'Perdido', lead_state: 'LOST', state_updated_at: agora,
      is_lost: true, lost_at: agora, lost_reason: motivo, updated_at: agora,
    } as any)
    .eq('id', leadId);

  if (error) return { error };

  await supabase.from('lead_state_history').insert({
    lead_id: leadId,
    from_state: (leadAntes as any)?.lead_state || null,
    to_state: 'LOST',
    changed_by: changedBy,
    reason: motivo,
  });

  return { error: null };
}
