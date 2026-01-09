import { useState, useEffect } from 'react';
import { InlineWidget, useCalendlyEventListener } from 'react-calendly';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, X, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CalendlyWidgetProps {
  subscriberId: string;
  subscriberName?: string;
  subscriberEmail?: string;
  subscriberPhone?: string;
  leadId?: string;
  onScheduled?: (eventData: any) => void;
}

const CALENDLY_URL = 'https://calendly.com/bentesramos-adv/consulta-juridica';

const CalendlyWidget = ({
  subscriberId,
  subscriberName,
  subscriberEmail,
  subscriberPhone,
  leadId,
  onScheduled
}: CalendlyWidgetProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Listener para eventos do Calendly
  useCalendlyEventListener({
    onEventScheduled: async (e) => {
      console.log('Calendly event scheduled:', e.data.payload);
      setIsCreating(true);
      
      try {
        const eventUri = e.data.payload.event?.uri;
        const inviteeUri = e.data.payload.invitee?.uri;
        
        // Criar compromisso no CRM
        const { data: compromisso, error } = await supabase
          .from('compromissos')
          .insert({
            titulo: `Consulta Jurídica - ${subscriberName || 'Cliente'}`,
            tipo: 'Reunião',
            data_inicio: new Date().toISOString(), // Será atualizado pelo webhook
            descricao: `Agendamento via Calendly.\n\nEvento: ${eventUri}\nConvidado: ${inviteeUri}`,
            lead_id: leadId,
            origem: 'calendly',
            external_id: eventUri,
          })
          .select()
          .single();

        if (error) throw error;

        // Registrar interação
        if (leadId) {
          await supabase.from('interacoes').insert({
            cliente_id: leadId,
            tipo: 'Agendamento',
            resumo: `Cliente agendou consulta via Calendly`,
            detalhes: `Agendamento realizado pelo cliente através do widget Calendly no chat.`,
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
          acao: 'calendly_scheduled',
          fonte: 'calendly',
          lead_id: leadId,
          entidade_tipo: 'compromisso',
          entidade_id: compromisso?.id,
          dados: {
            subscriber_id: subscriberId,
            subscriber_name: subscriberName,
            event_uri: eventUri,
            invitee_uri: inviteeUri,
          },
        });

        // Enviar mensagem de confirmação para o ManyChat
        try {
          await supabase.functions.invoke('manychat', {
            body: {
              action: 'enviar_mensagem',
              subscriberId: subscriberId,
              message: `✅ Agendamento confirmado!\n\nSua consulta jurídica foi agendada com sucesso. Você receberá um e-mail com os detalhes.\n\nAguardamos você! 📅`,
              type: 'text',
            },
          });
          
          // Salvar mensagem no histórico
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: subscriberName,
            conteudo: `✅ Agendamento confirmado!\n\nSua consulta jurídica foi agendada com sucesso. Você receberá um e-mail com os detalhes.\n\nAguardamos você! 📅`,
            tipo: 'text',
            direcao: 'saida',
            lead_id: leadId,
          });
        } catch (msgError) {
          console.error('Erro ao enviar confirmação ManyChat:', msgError);
        }

        setIsScheduled(true);
        toast({
          title: '✅ Consulta Agendada!',
          description: 'O agendamento foi registrado no CRM automaticamente.',
        });

        onScheduled?.(e.data.payload);
        
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
    },
  });

  // Prefill data for Calendly
  const prefill = {
    name: subscriberName || '',
    email: subscriberEmail || '',
    customAnswers: {
      a1: subscriberPhone || '',
    },
  };

  const pageSettings = {
    backgroundColor: 'ffffff',
    hideEventTypeDetails: false,
    hideLandingPageDetails: false,
    primaryColor: '00a884',
    textColor: '111b21',
    hideGdprBanner: true,
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

      {/* Modal com Widget do Calendly */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[85vh] p-0 overflow-hidden">
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

          <div className="flex-1 overflow-hidden">
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
              <InlineWidget
                url={CALENDLY_URL}
                prefill={prefill}
                pageSettings={pageSettings}
                styles={{
                  height: '100%',
                  minWidth: '320px',
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CalendlyWidget;
