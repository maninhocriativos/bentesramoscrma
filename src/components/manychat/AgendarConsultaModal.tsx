import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, X, CheckCircle, Loader2, Building2, Video, ArrowLeft, MapPin, Clock3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AgendarConsultaModalProps {
  subscriberId: string;
  subscriberName?: string;
  subscriberEmail?: string;
  subscriberPhone?: string;
  leadId?: string;
  onScheduled?: (eventData: any) => void;
}

interface Horario {
  label: string;
  short: string;
  datetime: string;
}

type Modalidade = 'presencial' | 'online';
type Step = 'modalidade' | 'horarios' | 'confirmar' | 'sucesso';

// Agrupa os horários por dia (chave yyyy-mm-dd derivada do label "Segunda-feira, 20/07 às 09:00").
function agruparPorDia(horarios: Horario[]): { dia: string; itens: Horario[] }[] {
  const grupos = new Map<string, Horario[]>();
  for (const h of horarios) {
    const dia = h.label.split(' às ')[0];
    if (!grupos.has(dia)) grupos.set(dia, []);
    grupos.get(dia)!.push(h);
  }
  return Array.from(grupos.entries()).map(([dia, itens]) => ({ dia, itens }));
}

const AgendarConsultaModal = ({
  subscriberId,
  subscriberName,
  subscriberEmail,
  subscriberPhone,
  leadId,
  onScheduled,
}: AgendarConsultaModalProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<Step>('modalidade');
  const [modalidade, setModalidade] = useState<Modalidade | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [loadingHorarios, setLoadingHorarios] = useState(false);
  const [selecionado, setSelecionado] = useState<Horario | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [resultado, setResultado] = useState<{ mensagem: string; localReuniao: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const reset = () => {
    setStep('modalidade');
    setModalidade(null);
    setHorarios([]);
    setSelecionado(null);
    setResultado(null);
    setErro(null);
  };

  const fecharModal = () => {
    setIsOpen(false);
    setTimeout(reset, 300);
  };

  const escolherModalidade = async (m: Modalidade) => {
    setModalidade(m);
    setStep('horarios');
    setLoadingHorarios(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('calcom-integration', {
        body: { action: 'buscar_horarios' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não foi possível buscar horários');
      setHorarios(data.horarios || []);
    } catch (e: any) {
      setErro(e.message || 'Erro ao buscar horários disponíveis');
    } finally {
      setLoadingHorarios(false);
    }
  };

  const confirmarAgendamento = async () => {
    if (!selecionado || !modalidade) return;
    setConfirmando(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke('calcom-integration', {
        body: {
          action: 'agendar',
          datetime: selecionado.datetime,
          nome: subscriberName || 'Cliente',
          email: subscriberEmail || undefined,
          telefone: subscriberPhone || undefined,
          leadId: leadId || undefined,
          subscriberId,
          modalidade,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Não foi possível confirmar o agendamento');

      // Envia a confirmação por WhatsApp (a edge function só cria o compromisso
      // e devolve o texto — o disparo é feito aqui, igual ao fluxo anterior).
      const phone = subscriberPhone || subscriberId?.replace('zapi_', '') || '';
      if (phone) {
        try {
          await supabase.functions.invoke('zapi-send', {
            body: { to_phone: phone, message: data.mensagem, type: 'text', lead_id: leadId },
          });
          await supabase.from('manychat_mensagens').insert({
            subscriber_id: subscriberId,
            subscriber_nome: subscriberName,
            conteudo: data.mensagem,
            tipo: 'text',
            direcao: 'saida',
            lead_id: leadId || null,
          });
        } catch (msgError) {
          console.error('Erro ao enviar confirmação via Z-API:', msgError);
        }
      }

      setResultado({ mensagem: data.mensagem, localReuniao: data.localReuniao });
      setStep('sucesso');
      toast({ title: '✅ Consulta agendada!', description: 'O agendamento foi registrado no CRM automaticamente.' });
      onScheduled?.(data);

      setTimeout(() => { fecharModal(); }, 2500);
    } catch (e: any) {
      if (e.message?.includes('acabou de ser reservado')) {
        toast({ title: 'Horário indisponível', description: e.message, variant: 'destructive' });
        setStep('horarios');
        escolherModalidade(modalidade);
      } else {
        setErro(e.message || 'Erro ao confirmar agendamento');
      }
    } finally {
      setConfirmando(false);
    }
  };

  const grupos = agruparPorDia(horarios);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-10 w-10 rounded-full text-[#00A884] hover:bg-[#00A884]/10 dark:hover:bg-[#00A884]/20"
        title="Agendar consulta"
      >
        <Calendar className="h-6 w-6" />
      </Button>

      <Dialog open={isOpen} onOpenChange={(v) => { if (!v) fecharModal(); }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0" hideCloseButton>
          <DialogHeader className="px-6 py-4 border-b bg-[#00A884] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {step !== 'modalidade' && step !== 'sucesso' && (
                  <button
                    onClick={() => setStep(step === 'confirmar' ? 'horarios' : 'modalidade')}
                    className="rounded-full p-1 hover:bg-white/20 transition-colors"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                )}
                <Calendar className="h-6 w-6" />
                <DialogTitle className="text-lg font-medium text-white">
                  Agendar Consulta Jurídica
                </DialogTitle>
              </div>
              <button onClick={fecharModal} className="rounded-full p-1.5 hover:bg-white/20 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
          </DialogHeader>

          <div className="p-6 min-h-[360px] flex flex-col">
            {step === 'modalidade' && (
              <div className="flex-1 flex flex-col justify-center gap-4">
                <p className="text-sm text-muted-foreground text-center mb-2">Como será a consulta?</p>
                <button
                  onClick={() => escolherModalidade('presencial')}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-amber-500 hover:bg-amber-500/5 transition-all text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Building2 className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Presencial</p>
                    <p className="text-xs text-muted-foreground">No escritório, Rua Salvador, 120 — Manaus/AM</p>
                  </div>
                </button>
                <button
                  onClick={() => escolherModalidade('online')}
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-border hover:border-[#00A884] hover:bg-[#00A884]/5 transition-all text-left"
                >
                  <div className="h-12 w-12 rounded-full bg-[#00A884]/10 flex items-center justify-center shrink-0">
                    <Video className="h-6 w-6 text-[#00A884]" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Online</p>
                    <p className="text-xs text-muted-foreground">Videochamada por Google Meet</p>
                  </div>
                </button>
              </div>
            )}

            {step === 'horarios' && (
              <div className="flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                  {modalidade === 'presencial' ? <Building2 className="h-4 w-4 text-amber-600" /> : <Video className="h-4 w-4 text-[#00A884]" />}
                  <span>{modalidade === 'presencial' ? 'Presencial' : 'Online'} — escolha um horário</span>
                </div>
                {loadingHorarios ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="h-8 w-8 text-[#00A884] animate-spin" />
                    <p className="text-sm text-muted-foreground">Buscando horários disponíveis...</p>
                  </div>
                ) : erro ? (
                  <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                    <p className="text-sm text-destructive">{erro}</p>
                    <Button variant="outline" size="sm" onClick={() => modalidade && escolherModalidade(modalidade)}>Tentar novamente</Button>
                  </div>
                ) : grupos.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-muted-foreground text-center">Não há horários disponíveis no momento.<br />Entre em contato diretamente com o escritório.</p>
                  </div>
                ) : (
                  <div className="space-y-4 overflow-y-auto max-h-[320px] pr-1">
                    {grupos.map(({ dia, itens }) => (
                      <div key={dia}>
                        <p className="text-xs font-medium text-muted-foreground mb-2 capitalize">{dia}</p>
                        <div className="grid grid-cols-3 gap-2">
                          {itens.map(h => (
                            <button
                              key={h.datetime}
                              onClick={() => { setSelecionado(h); setStep('confirmar'); }}
                              className="flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border border-border hover:border-[#00A884] hover:bg-[#00A884]/5 text-sm font-medium transition-all"
                            >
                              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
                              {h.short.split(' ')[1]}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {step === 'confirmar' && selecionado && (
              <div className="flex-1 flex flex-col justify-center gap-5">
                <div className="rounded-xl border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="font-medium capitalize">{selecionado.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {modalidade === 'presencial' ? <Building2 className="h-4 w-4 text-amber-600 shrink-0" /> : <Video className="h-4 w-4 text-[#00A884] shrink-0" />}
                    <span>{modalidade === 'presencial' ? 'Presencial' : 'Online (Google Meet)'}</span>
                  </div>
                  {modalidade === 'presencial' && (
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Rua Salvador, 120, Sala 708 – Vieiralves Business Center – Adrianópolis, Manaus/AM</span>
                    </div>
                  )}
                  {subscriberName && (
                    <div className="text-sm text-muted-foreground pt-1 border-t border-border">
                      Cliente: <span className="text-foreground font-medium">{subscriberName}</span>
                    </div>
                  )}
                </div>
                {erro && <p className="text-sm text-destructive text-center">{erro}</p>}
                <Button
                  onClick={confirmarAgendamento}
                  disabled={confirmando}
                  className="bg-[#00A884] hover:bg-[#00A884]/90 text-white gap-2"
                >
                  {confirmando ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Confirmar Agendamento
                </Button>
              </div>
            )}

            {step === 'sucesso' && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div className="w-20 h-20 rounded-full bg-[#00A884]/10 flex items-center justify-center">
                  <CheckCircle className="h-12 w-12 text-[#00A884]" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Agendamento Confirmado!</h3>
                <p className="text-muted-foreground max-w-sm">
                  {modalidade === 'presencial'
                    ? 'A consulta presencial foi agendada. O cliente já recebeu a confirmação com o endereço.'
                    : 'A consulta online foi agendada. O cliente já recebeu a confirmação com o link da reunião.'}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AgendarConsultaModal;
