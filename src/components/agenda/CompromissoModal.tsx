import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Compromisso, TipoCompromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { useCompromissos } from '@/hooks/useCompromissos';
import {
  Loader2, Trash2, X, Pencil, CalendarIcon, Clock, FileText,
  Briefcase, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// =============================================================================
// CONFIG
// =============================================================================

const MANAUS_TZ = 'America/Manaus';

const formSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório').max(200),
  descricao: z.string().optional(),
  data_inicio: z.string().min(1, 'Data é obrigatória'),
  hora_inicio: z.string().min(1, 'Hora é obrigatória'),
  tipo: z.enum(['Reunião', 'Audiência', 'Prazo', 'Tarefa', 'Outro']),
});

type FormData = z.infer<typeof formSchema>;

interface CompromissoModalProps {
  isOpen: boolean;
  onClose: () => void;
  compromisso?: Compromisso | null;
  selectedDate?: Date;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; emoji: string }> = {
  pendente:   { label: 'Pendente',   emoji: '⏳', className: 'bg-amber-500 text-white' },
  confirmado: { label: 'Confirmado', emoji: '✅', className: 'bg-emerald-500 text-white' },
  cancelado:  { label: 'Cancelado',  emoji: '❌', className: 'bg-red-500 text-white' },
  remarcado:  { label: 'Remarcado',  emoji: '🔄', className: 'bg-blue-500 text-white' },
};

const TIPO_ICONS: Record<string, string> = {
  'Reunião':   '🤝',
  'Audiência': '⚖️',
  'Prazo':     '⏰',
  'Tarefa':    '📋',
  'Outro':     '📌',
};

// =============================================================================
// COMPONENTE
// =============================================================================

export function CompromissoModal({ isOpen, onClose, compromisso, selectedDate }: CompromissoModalProps) {
  const { createCompromisso, updateCompromisso, deleteCompromisso } = useCompromissos();
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isNew = !compromisso;
  const showForm = isNew || isEditing;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      titulo: '',
      descricao: '',
      data_inicio: '',
      hora_inicio: '09:00',
      tipo: 'Reunião',
    },
  });

  // ─── Inicialização do formulário ────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    if (compromisso) {
      // EDITAR: preenche com dados do compromisso (convertendo UTC → Manaus)
      const dataStr = formatInTimeZone(new Date(compromisso.data_inicio), MANAUS_TZ, 'yyyy-MM-dd');
      const horaStr = formatInTimeZone(new Date(compromisso.data_inicio), MANAUS_TZ, 'HH:mm');
      form.reset({
        titulo: compromisso.titulo,
        descricao: compromisso.descricao || '',
        data_inicio: dataStr,
        hora_inicio: horaStr,
        tipo: compromisso.tipo as TipoCompromisso,
      });
      setIsEditing(false);
    } else {
      // NOVO: usa selectedDate ou hoje
      const baseDate = selectedDate || new Date();
      const dataStr = formatInTimeZone(baseDate, MANAUS_TZ, 'yyyy-MM-dd');
      form.reset({
        titulo: '',
        descricao: '',
        data_inicio: dataStr,
        hora_inicio: '09:00',
        tipo: 'Reunião',
      });
      setIsEditing(true);
    }
  }, [compromisso, selectedDate, isOpen, form]);

  // ─── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (data: FormData) => {
    console.log('[CompromissoModal] onSubmit:', data);
    setSubmitting(true);

    try {
      // Combina data + hora como horário de Manaus, depois converte para UTC ISO
      const dataHoraLocal = `${data.data_inicio}T${data.hora_inicio}:00`;
      const dataUtc = fromZonedTime(dataHoraLocal, MANAUS_TZ);
      const dataIsoUtc = dataUtc.toISOString();

      console.log('[CompromissoModal] Data Manaus:', dataHoraLocal, '→ UTC:', dataIsoUtc);

      if (compromisso) {
        const result = await updateCompromisso(compromisso.id, {
          titulo: data.titulo,
          descricao: data.descricao || null,
          data_inicio: dataIsoUtc,
          tipo: data.tipo,
        });
        if (result?.error) return;
      } else {
        const result = await createCompromisso({
          titulo: data.titulo,
          descricao: data.descricao || null,
          data_inicio: dataIsoUtc,
          data_fim: null,
          tipo: data.tipo,
          lead_id: null,
          processo_id: null,
          responsavel_id: null,
        });
        if (result?.error) return;
      }

      onClose();
    } catch (err) {
      console.error('[CompromissoModal] Exception:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Deletar ───────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!compromisso) return;
    if (!window.confirm(`Excluir "${compromisso.titulo}"?`)) return;
    await deleteCompromisso(compromisso.id);
    onClose();
  };

  // ─── Mudar status ──────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: ConfirmacaoStatus) => {
    if (!compromisso) return;
    await updateCompromisso(compromisso.id, { confirmacao_status: newStatus });
  };

  const currentStatus = compromisso?.confirmacao_status || 'pendente';
  const statusCfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.pendente;

  // ─── Formatação para view mode ─────────────────────────────────────────────
  const getFormattedDate = () => {
    if (!compromisso) return '';
    return formatInTimeZone(new Date(compromisso.data_inicio), MANAUS_TZ, 'dd/MM/yyyy');
  };
  const getFormattedTime = () => {
    if (!compromisso) return '';
    return formatInTimeZone(new Date(compromisso.data_inicio), MANAUS_TZ, 'HH:mm');
  };
  const getDayOfWeek = () => {
    if (!compromisso) return '';
    return formatInTimeZone(new Date(compromisso.data_inicio), MANAUS_TZ, 'EEEE');
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl"
        onOpenAutoFocus={e => e.preventDefault()}
      >
        {/* Acessibilidade */}
        <DialogHeader className="sr-only">
          <DialogTitle>{isNew ? 'Novo Compromisso' : compromisso?.titulo || 'Compromisso'}</DialogTitle>
          <DialogDescription>
            {isNew ? 'Preencha os dados para criar um novo compromisso na agenda.' : 'Visualize ou edite o compromisso.'}
          </DialogDescription>
        </DialogHeader>

        {/* Header */}
        <div className="relative" style={{ background: '#3d2b1f' }}>
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#c9a96e] to-[#a88858]" />
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.3)' }}
              >
                {isNew ? <Pencil className="h-5 w-5" style={{ color: '#c9a96e' }} /> : (
                  <span>{TIPO_ICONS[compromisso?.tipo || 'Outro'] || '📌'}</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold truncate" style={{ color: '#c9a96e' }}>
                  {isNew ? 'Novo Compromisso' : compromisso?.titulo}
                </h2>
                <p className="text-[11px] opacity-70" style={{ color: '#c9a96e' }}>
                  {isNew ? 'Preencha os dados abaixo' : `${getDayOfWeek()} · ${getFormattedDate()} · ${getFormattedTime()}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg transition-colors shrink-0"
              style={{ color: '#c9a96e' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(201,169,110,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action bar (apenas em view mode) */}
        {!isNew && !showForm && (
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/20">
            <Select value={currentStatus} onValueChange={(v) => handleStatusChange(v as ConfirmacaoStatus)}>
              <SelectTrigger className={cn('w-[140px] h-8 text-xs font-bold rounded-lg border-0', statusCfg.className)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_CONFIG).map(([k, cfg]) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {cfg.emoji} {cfg.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg" onClick={() => setIsEditing(true)}>
              <Pencil className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg text-red-600 hover:bg-red-500/10 hover:text-red-700 border-red-500/30" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Excluir
            </Button>
          </div>
        )}

        {/* Conteúdo */}
        <div className="px-5 py-5 max-h-[65vh] overflow-y-auto">
          {showForm ? (
            // ─── FORMULÁRIO ───────────────────────────────────────────────
            <Form {...form}>
              <form
                id="compromisso-form"
                name="compromisso-form"
                onSubmit={form.handleSubmit(onSubmit, (errors) => {
                  console.error('[CompromissoModal] Validation failed:', errors);
                })}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="cmp-titulo" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <FileText className="h-3 w-3" /> Título
                      </FormLabel>
                      <FormControl>
                        <Input
                          id="cmp-titulo"
                          placeholder="Ex: Reunião com cliente João"
                          autoComplete="off"
                          className="h-10 rounded-xl"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tipo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="cmp-tipo" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                        <Briefcase className="h-3 w-3" /> Tipo
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger id="cmp-tipo" className="h-10 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TIPO_ICONS).map(([t, icon]) => (
                            <SelectItem key={t} value={t}>
                              {icon} {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="data_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="cmp-data" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <CalendarIcon className="h-3 w-3" /> Data
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="cmp-data"
                            type="date"
                            autoComplete="off"
                            className="h-10 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="hora_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel htmlFor="cmp-hora" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Hora
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="cmp-hora"
                            type="time"
                            autoComplete="off"
                            className="h-10 rounded-xl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="descricao"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="cmp-descricao" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                        Descrição (opcional)
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          id="cmp-descricao"
                          placeholder="Detalhes do compromisso, link de reunião, observações..."
                          className="resize-none rounded-xl"
                          rows={3}
                          autoComplete="off"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Botões */}
                <div className="flex gap-2 pt-3 border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => isNew ? onClose() : setIsEditing(false)}
                    className="flex-1 h-10 rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-10 rounded-xl gap-2"
                    disabled={submitting}
                    style={{ background: '#3d2b1f', color: '#c9a96e' }}
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? 'Salvando...' : (compromisso ? 'Salvar alterações' : 'Criar compromisso')}
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            // ─── VIEW MODE ────────────────────────────────────────────────
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 border border-border/40 bg-muted/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Briefcase className="h-3 w-3" /> Tipo
                  </p>
                  <p className="text-sm font-bold">
                    {TIPO_ICONS[compromisso?.tipo || 'Outro']} {compromisso?.tipo}
                  </p>
                </div>
                <div className="rounded-xl p-3 border border-border/40 bg-muted/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
                    <AlertCircle className="h-3 w-3" /> Status
                  </p>
                  <Badge className={cn('text-[10px] font-bold', statusCfg.className)}>
                    {statusCfg.emoji} {statusCfg.label}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl p-3 border border-border/40 bg-muted/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
                    <CalendarIcon className="h-3 w-3" /> Data
                  </p>
                  <p className="text-sm font-bold">{getFormattedDate()}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{getDayOfWeek()}</p>
                </div>
                <div className="rounded-xl p-3 border border-border/40 bg-muted/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 mb-1">
                    <Clock className="h-3 w-3" /> Horário
                  </p>
                  <p className="text-sm font-bold">{getFormattedTime()}</p>
                  <p className="text-[10px] text-muted-foreground">Manaus (AMT)</p>
                </div>
              </div>

              {compromisso?.descricao && (
                <div className="rounded-xl p-3 border border-border/40 bg-muted/20">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                    Descrição
                  </p>
                  <p className="text-sm whitespace-pre-wrap break-words">{compromisso.descricao}</p>
                </div>
              )}

              {compromisso?.processo_id && (
                <div className="rounded-xl p-3 border border-amber-500/30 bg-amber-500/5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400 mb-1">
                    🔗 Processo vinculado
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">{compromisso.processo_id}</p>
                </div>
              )}

              <div className="text-[10px] text-muted-foreground space-y-0.5 pt-2 border-t border-border/30">
                <p>Criado em: {compromisso?.created_at ? format(new Date(compromisso.created_at), 'dd/MM/yyyy HH:mm') : '—'}</p>
                <p>Atualizado em: {compromisso?.updated_at ? format(new Date(compromisso.updated_at), 'dd/MM/yyyy HH:mm') : '—'}</p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
