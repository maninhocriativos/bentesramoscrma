import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCallback } from 'react';

interface MetaEventData {
  lead_id: string;
  facebook_lead_id?: string | null;
  email?: string | null;
  phone?: string | null;
  event_name?: string;
  value?: number;
  status?: string;
}

export function useMetaCapi() {
  const { toast } = useToast();

  const sendMetaEvent = useCallback(async (data: MetaEventData) => {
    try {
      console.log('[Meta CAPI] Sending conversion event:', data.event_name || 'Purchase');
      
      const { data: result, error } = await supabase.functions.invoke('send-meta-event', {
        body: data
      });

      if (error) {
        console.error('[Meta CAPI] Error invoking function:', error);
        return { success: false, error: error.message };
      }

      if (result?.success) {
        console.log('[Meta CAPI] Event sent successfully:', result);
        toast({
          title: 'Evento enviado para Meta',
          description: `Conversão "${data.event_name || 'Purchase'}" registrada com sucesso.`,
        });
        return { success: true, data: result };
      } else {
        console.warn('[Meta CAPI] Event not sent:', result);
        return { success: false, warning: result?.warning, error: result?.error };
      }
    } catch (err) {
      console.error('[Meta CAPI] Unexpected error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({
        title: 'Erro ao enviar evento',
        description: errorMessage,
        variant: 'destructive',
      });
      return { success: false, error: errorMessage };
    }
  }, [toast]);

  // Função específica para conversões (quando lead vai para "Ganho")
  const sendConversionEvent = useCallback(async (
    leadId: string,
    leadData: {
      email?: string | null;
      phone?: string | null;
      facebook_lead_id?: string | null;
      valor_causa?: number | null;
    }
  ) => {
    return sendMetaEvent({
      lead_id: leadId,
      facebook_lead_id: leadData.facebook_lead_id,
      email: leadData.email,
      phone: leadData.phone,
      event_name: 'Purchase',
      value: leadData.valor_causa || 0,
      status: 'Ganho'
    });
  }, [sendMetaEvent]);

  return {
    sendMetaEvent,
    sendConversionEvent
  };
}