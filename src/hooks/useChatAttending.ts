import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useChatAttending(userId: string | undefined, userNome: string) {
  const currentSubRef = useRef<string | null>(null);

  // Limpa attending_by (presença em tempo real) ao sair da página
  useEffect(() => {
    if (!userId) return;
    const clear = () => {
      // sendBeacon para garantir envio mesmo no unload
      const url = `${(supabase as any).supabaseUrl}/rest/v1/manychat_subscribers?attending_by=eq.${userId}`;
      const body = JSON.stringify({ attending_by: null, attending_nome: null, attending_since: null });
      try {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } catch { /* fallback silencioso */ }
    };
    window.addEventListener('beforeunload', clear);
    return () => {
      window.removeEventListener('beforeunload', clear);
      // Limpa ao desmontar componente (troca de página)
      if (userId) {
        supabase
          .from('manychat_subscribers' as any)
          .update({ attending_by: null, attending_nome: null, attending_since: null } as any)
          .eq('attending_by', userId)
          .then(() => {});
      }
    };
  }, [userId]);

  const setAttending = useCallback(async (subscriberId: string | null) => {
    if (!userId) return;

    // Limpa presença em tempo real do atendimento anterior deste usuário
    await supabase
      .from('manychat_subscribers' as any)
      .update({ attending_by: null, attending_nome: null, attending_since: null } as any)
      .eq('attending_by', userId);

    currentSubRef.current = subscriberId;

    if (subscriberId) {
      // Busca quem era o último atendente desta conversa
      const { data: sub } = await supabase
        .from('manychat_subscribers' as any)
        .select('last_attended_by, last_attended_nome')
        .eq('subscriber_id', subscriberId)
        .single();

      const prevBy   = (sub as any)?.last_attended_by   ?? null;
      const prevNome = (sub as any)?.last_attended_nome ?? null;

      // Decide o tipo de evento:
      //   - 'primeiro_atendimento' → ninguém havia atendido ainda
      //   - 'assumiu'              → um usuário diferente abre a conversa
      //   - 'retomou'              → o mesmo usuário abre de novo (sem log, não poluir)
      let action: string | null = null;
      if (!prevBy) {
        action = 'primeiro_atendimento';
      } else if (prevBy !== userId) {
        action = 'assumiu';
      }
      // se prevBy === userId: não loga (o mesmo usuário apenas reabriu)

      if (action) {
        await supabase
          .from('chat_atendimento_log' as any)
          .insert({
            subscriber_id:      subscriberId,
            user_id:            userId,
            user_nome:          userNome,
            previous_user_id:   prevBy,
            previous_user_nome: prevNome,
            action,
          } as any);
      }

      // Atualiza presença em tempo real + registro permanente de último atendente
      await supabase
        .from('manychat_subscribers' as any)
        .update({
          attending_by:       userId,
          attending_nome:     userNome,
          attending_since:    new Date().toISOString(),
          last_attended_by:   userId,
          last_attended_nome: userNome,
          last_attended_at:   new Date().toISOString(),
        } as any)
        .eq('subscriber_id', subscriberId);
    }
  }, [userId, userNome]);

  return { setAttending };
}
