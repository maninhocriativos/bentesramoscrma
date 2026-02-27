import { useState, useEffect } from 'react';
import Cal, { getCalApi } from "@calcom/embed-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, X, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalWidgetProps {
  subscriberId: string;
  subscriberName?: string;
  subscriberEmail?: string;
  subscriberPhone?: string;
  leadId?: string;
  onScheduled?: (eventData: any) => void;
}

const CAL_LINK = 'bentes-ramos-advocacia-1ucmau/agendamentos-crm';

const CalWidget = ({
  subscriberId,
  subscriberName,
  subscriberEmail,
  subscriberPhone,
  leadId,
  onScheduled
}: CalWidgetProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    (async function () {
      const cal = await getCalApi({ namespace: "agendamentos-crm" });
      cal("ui", {
        cssVarsPerTheme: {
          dark: { "cal-brand": "#00A884" },
          light: { "cal-brand": "#00A884" }
        },
        hideEventTypeDetails: false,
        layout: "month_view"
      });

      // Listener para eventos de agendamento
      cal("on", {
        action: "bookingSuccessful",
        callback: async (e: any) => {
          console.log('Cal.com booking successful:', e);
          await handleBookingSuccess(e);
        }
      });
    })();
  }, []);

  const handleBookingSuccess = async (eventData: any) => {
    console.log('Cal.com event scheduled:', eventData);
    setIsCreating(true);
    
    try {
      const bookingId = eventData?.data?.booking?.id || eventData?.detail?.data?.booking?.id;
      const bookingUid = eventData?.data?.booking?.uid || eventData?.detail?.data?.booking?.uid;
      
      // Criar compromisso no CRM
      const { data: compromisso, error } = await supabase
        .from('compromissos')
        .insert({
          titulo: `Consulta Jurídica - ${subscriberName || 'Cliente'}`,
          tipo: 'Reunião',
          data_inicio: new Date().toISOString(), // Será atualizado pelo webhook
          descricao: `Agendamento via Cal.com.\n\nBooking ID: ${bookingId}\nBooking UID: ${bookingUid}`,
          lead_id: leadId,
          origem: 'cal.com',
          external_id: bookingUid || bookingId,
        })
        .select()
        .single();

      if (error) throw error;

      // Registrar interação
      if (leadId) {
        await supabase.from('interacoes').insert({
          cliente_id: leadId,
          tipo: 'Agendamento',
          resumo: `Cliente agendou consulta via Cal.com`,
          detalhes: `Agendamento realizado pelo cliente através do widget Cal.com no chat.`,
          direcao: 'entrada',
          data_interacao: new Date().toISOString(),
        });

        // Atualizar status do lead se necessário
        const { data: lead } = await supabase
          .from('leads_juridicos')
          .select('status')
          .eq('id', leadId)
          .single();

        if (lead?.status === 'Lead Frio') {
          await supabase
            .from('leads_juridicos')
            .update({ status: 'Em Atendimento', updated_at: new Date().toISOString() })
            .eq('id', leadId);
        }
      }

      // Criar evento de sistema
      await supabase.from('system_events').insert({
        tipo: 'agendamento',
        acao: 'cal_scheduled',
        fonte: 'cal.com',
        lead_id: leadId,
        entidade_tipo: 'compromisso',
        entidade_id: compromisso?.id,
        dados: {
          subscriber_id: subscriberId,
          subscriber_name: subscriberName,
          booking_id: bookingId,
          booking_uid: bookingUid,
        },
      });

      // Enviar mensagem de confirmação via Z-API
      try {
        const confirmMsg = `✅ Agendamento confirmado!\n\nSua consulta jurídica foi agendada com sucesso. Você receberá um e-mail com os detalhes.\n\nAguardamos você! 📅`;
        
        // Extrair telefone do subscriberId (formato zapi_55XXXXXXXXXXX)
        const phone = subscriberId?.replace('zapi_', '') || '';
        if (phone) {
          await supabase.functions.invoke('zapi-send', {
            body: {
              to_phone: phone,
              message: confirmMsg,
              type: 'text',
              lead_id: leadId,
            },
          });
        }
        
        // Salvar mensagem no histórico
        await supabase.from('manychat_mensagens').insert({
          subscriber_id: subscriberId,
          subscriber_nome: subscriberName,
          conteudo: confirmMsg,
          tipo: 'text',
          direcao: 'saida',
          lead_id: leadId,
        });
      } catch (msgError) {
        console.error('Erro ao enviar confirmação via Z-API:', msgError);
      }

      setIsScheduled(true);
      toast({
        title: '✅ Consulta Agendada!',
        description: 'O agendamento foi registrado no CRM automaticamente.',
      });

      onScheduled?.(eventData);
      
      // Fechar modal após 2 segundos
      setTimeout(() => {
        setIsOpen(false);
        setIsScheduled(false);
      }, 2000);
      
    } catch (error) {
      console.error('Erro ao criar compromisso:', error);
      toast({
        title: 'Aviso',
        description: 'Agendamento realizado, mas houve um erro ao registrar no CRM.',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Botão de Agendar */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-10 w-10 rounded-full text-[#00A884] hover:bg-[#00A884]/10 dark:hover:bg-[#00A884]/20"
        title="Agendar consulta"
      >
        <Calendar className="h-6 w-6" />
      </Button>

      {/* Modal com Widget do Cal.com */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-3xl h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-[#00A884] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="h-6 w-6" />
                <DialogTitle className="text-lg font-medium text-white">
                  Agendar Consulta Jurídica
                </DialogTitle>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 text-white hover:bg-white/20 rounded-full"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 h-full overflow-auto">
            {isScheduled ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                <div className="w-20 h-20 rounded-full bg-[#00A884]/10 flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-[#00A884]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Agendamento Confirmado!</h3>
                <p className="text-muted-foreground text-center max-w-sm">
                  Sua consulta foi agendada com sucesso. Você receberá uma confirmação por email.
                </p>
              </div>
            ) : isCreating ? (
              <div className="h-full flex flex-col items-center justify-center gap-4 p-8">
                <Loader2 className="h-12 w-12 text-[#00A884] animate-spin" />
                <p className="text-muted-foreground">Registrando agendamento...</p>
              </div>
            ) : (
              <Cal
                namespace="agendamentos-crm"
                calLink={CAL_LINK}
                style={{ width: "100%", height: "100%", overflow: "scroll" }}
                config={{
                  layout: "month_view",
                  name: subscriberName || undefined,
                  email: subscriberEmail || undefined,
                  notes: subscriberPhone ? `Telefone: ${subscriberPhone}` : undefined,
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CalWidget;
