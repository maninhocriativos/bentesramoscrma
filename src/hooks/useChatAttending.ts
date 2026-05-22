import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useChatAttending(userId: string | undefined, userNome: string) {
  const currentSubRef = useRef<string | null>(null);

  // Limpa ao sair da página
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

    // Limpa atendimento anterior deste usuário
    await supabase
      .from('manychat_subscribers' as any)
      .update({ attending_by: null, attending_nome: null, attending_since: null } as any)
      .eq('attending_by', userId);

    currentSubRef.current = subscriberId;

    if (subscriberId) {
      await supabase
        .from('manychat_subscribers' as any)
        .update({
          attending_by: userId,
          attending_nome: userNome,
          attending_since: new Date().toISOString(),
        } as any)
        .eq('subscriber_id', subscriberId);
    }
  }, [userId, userNome]);

  return { setAttending };
}
