import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useChatAttending(userId: string | undefined, userNome: string) {
  const currentSubRef  = useRef<string | null>(null);
  const userNomeRef    = useRef(userNome);
  userNomeRef.current  = userNome;

  // Rastreia o último log inserido: chave = `${userId}:${subscriberId}`, valor = timestamp
  // Evita logs duplicados quando o componente re-renderiza e chama setAttending novamente
  const lastLogRef = useRef<Map<string, number>>(new Map());

  // Limpa attending_by (presença em tempo real) ao sair da página
  useEffect(() => {
    if (!userId) return;
    const clear = () => {
      const url = `${(supabase as any).supabaseUrl}/rest/v1/manychat_subscribers?attending_by=eq.${userId}`;
      const body = JSON.stringify({ attending_by: null, attending_nome: null, attending_since: null });
      try {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      } catch { /* fallback silencioso */ }
    };
    window.addEventListener('beforeunload', clear);
    return () => {
      window.removeEventListener('beforeunload', clear);
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
      const { data: sub } = await supabase
        .from('manychat_subscribers' as any)
        .select('last_attended_by, last_attended_nome')
        .eq('subscriber_id', subscriberId)
        .single();

      const prevBy   = (sub as any)?.last_attended_by   ?? null;
      const prevNome = (sub as any)?.last_attended_nome ?? null;

      let action: string | null = null;
      if (!prevBy) {
        action = 'primeiro_atendimento';
      } else if (prevBy !== userId) {
        action = 'assumiu';
      }

      if (action) {
        // Cooldown de 60 s por (userId + subscriberId) para evitar logs duplicados
        // causados por re-renders do componente ou mudança do userNome ao carregar perfil
        const logKey = `${userId}:${subscriberId}`;
        const lastLogged = lastLogRef.current.get(logKey) ?? 0;
        const elapsed    = Date.now() - lastLogged;

        if (elapsed > 60_000) {
          lastLogRef.current.set(logKey, Date.now());
          await supabase
            .from('chat_atendimento_log' as any)
            .insert({
              subscriber_id:      subscriberId,
              user_id:            userId,
              user_nome:          userNomeRef.current,
              previous_user_id:   prevBy,
              previous_user_nome: prevNome,
              action,
            } as any);
        }
      }

      // Atualiza presença em tempo real + registro permanente de último atendente
      await supabase
        .from('manychat_subscribers' as any)
        .update({
          attending_by:       userId,
          attending_nome:     userNomeRef.current,
          attending_since:    new Date().toISOString(),
          last_attended_by:   userId,
          last_attended_nome: userNomeRef.current,
          last_attended_at:   new Date().toISOString(),
        } as any)
        .eq('subscriber_id', subscriberId);
    }
  // userId é a única dep real — userNome vai via ref para evitar que mudança
  // de nome (carregamento assíncrono do perfil) recrie a função e dispare log duplo
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { setAttending };
}
