import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
  Dialog,
  DialogContent,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Compromisso, TipoCompromisso, ConfirmacaoStatus } from '@/types/compromissos';
import { useCompromissos } from '@/hooks/useCompromissos';
import {
  Loader2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  MessageSquare,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  Pencil,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  titulo: z.string().min(1, 'Título é obrigatório'),
  descricao: z.string().optional(),
  data_inicio: z.string().min(1, 'Data é obrigatória'),
  hora_inicio: z.string().optional(),
  tipo: z.enum(['Reunião', 'Audiência', 'Prazo', 'Tarefa', 'Outro']),
});

type FormData = z.infer<typeof formSchema>;

interface CompromissoModalProps {
  isOpen: boolean;
  onClose: () => void;
  compromisso?: Compromisso | null;
  selectedDate?: Date;
}

const MANAUS_TZ = 'America/Manaus';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pendente: { label: 'A confirmar', className: 'bg-amber-500 text-white hover:bg-amber-600' },
  confirmado: { label: 'Confirmado', className: 'bg-emerald-500 text-white hover:bg-emerald-600' },
  cancelado: { label: 'Cancelado', className: 'bg-destructive text-destructive-foreground hover:bg-destructive/90' },
  remarcado: { label: 'Remarcado', className: 'bg-blue-500 text-white hover:bg-blue-600' },
};

const SITUACAO_OPTIONS: ConfirmacaoStatus[] = ['pendente', 'confirmado', 'cancelado', 'remarcado'];

function CollapsibleSection({
  icon: Icon,
  title,
  defaultOpen = false,
  actions,
  children,
}: {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border border-border/60 rounded-lg bg-card">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors rounded-lg">
            <div className="flex items-center gap-2 font-semibold text-sm text-foreground">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {title}
            </div>
            <div className="flex items-center gap-2">
              {actions && <div onClick={e => e.stopPropagation()}>{actions}</div>}
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function CompromissoModal({ isOpen, onClose, compromisso, selectedDate }: CompromissoModalProps) {
  const { createCompromisso, updateCompromisso, deleteCompromisso } = useCompromissos();
  const [isEditing, setIsEditing] = useState(false);
  const [comentario, setComentario] = useState('');

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

  useEffect(() => {
    if (compromisso) {
      const dataUtc = new Date(compromisso.data_inicio);
      const dataManaus = toZonedTime(dataUtc, MANAUS_TZ);
      form.reset({
        titulo: compromisso.titulo,
        descricao: compromisso.descricao || '',
        data_inicio: format(dataManaus, 'yyyy-MM-dd'),
        hora_inicio: format(dataManaus, 'HH:mm'),
        tipo: compromisso.tipo as TipoCompromisso,
      });
      setIsEditing(false);
    } else if (selectedDate) {
      const dataManaus = toZonedTime(selectedDate, MANAUS_TZ);
      form.reset({
        titulo: '',
        descricao: '',
        data_inicio: format(dataManaus, 'yyyy-MM-dd'),
        hora_inicio: '09:00',
        tipo: 'Reunião',
      });
      setIsEditing(true);
    }
  }, [compromisso, selectedDate, form]);

  const onSubmit = async (data: FormData) => {
    const dataHoraLocal = `${data.data_inicio}T${data.hora_inicio || '09:00'}:00`;
    const dataUtc = fromZonedTime(dataHoraLocal, MANAUS_TZ);

    if (compromisso) {
      await updateCompromisso(compromisso.id, {
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_inicio: dataUtc.toISOString(),
        tipo: data.tipo,
      });
    } else {
      await createCompromisso({
        titulo: data.titulo,
        descricao: data.descricao || null,
        data_inicio: dataUtc.toISOString(),
        data_fim: null,
        tipo: data.tipo,
        lead_id: null,
        processo_id: null,
        responsavel_id: null,
      });
    }
    onClose();
  };

  const handleDelete = async () => {
    if (compromisso && confirm('Deseja excluir este compromisso?')) {
      await deleteCompromisso(compromisso.id);
      onClose();
    }
  };

  const handleStatusChange = async (newStatus: ConfirmacaoStatus) => {
    if (compromisso) {
      await updateCompromisso(compromisso.id, { confirmacao_status: newStatus });
    }
  };

  const currentStatus = compromisso?.confirmacao_status || 'pendente';
  const statusCfg = STATUS_CONFIG[currentStatus];

  // Formatted dates for view mode
  const getFormattedDate = () => {
    if (!compromisso) return '';
    const d = toZonedTime(new Date(compromisso.data_inicio), MANAUS_TZ);
    return format(d, 'dd/MM/yyyy');
  };
  const getFormattedTime = () => {
    if (!compromisso) return '';
    const d = toZonedTime(new Date(compromisso.data_inicio), MANAUS_TZ);
    return format(d, 'HH:mm');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
        {/* Header - Projuris style */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="text-lg font-bold text-foreground">
            {isNew ? 'Novo Compromisso' : compromisso?.titulo}
          </h2>
          <div className="flex items-center gap-2">
            <Badge className={cn("text-xs px-3 py-1 rounded-md font-medium", statusCfg.className)}>
              {statusCfg.label}
            </Badge>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-md transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Action bar - Projuris style */}
        {!isNew && (
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border/40 bg-muted/20">
            <Select value={currentStatus} onValueChange={(v) => handleStatusChange(v as ConfirmacaoStatus)}>
              <SelectTrigger className={cn("w-[140px] h-8 text-xs font-medium rounded-md", statusCfg.className)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SITUACAO_OPTIONS.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {STATUS_CONFIG[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => setIsEditing(!isEditing)}>
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleDelete}>
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>
        )}

        <div className="px-6 py-5 space-y-5">
          {showForm ? (
            /* ── Edit / Create Form ── */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="titulo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold text-foreground">Título</FormLabel>
                      <FormControl>
                        <Input placeholder="Título do compromisso" {...field} />
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
                      <FormLabel className="text-xs font-bold text-foreground">Tipo da Tarefa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Reunião">Reunião</SelectItem>
                          <SelectItem value="Audiência">Audiência</SelectItem>
                          <SelectItem value="Prazo">Prazo</SelectItem>
                          <SelectItem value="Tarefa">Tarefa</SelectItem>
                          <SelectItem value="Outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="data_inicio"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-bold text-foreground">Data base</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
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
                        <FormLabel className="text-xs font-bold text-foreground">Hora</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
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
                      <FormLabel className="text-xs font-bold text-foreground">Descrição</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descrição opcional..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex gap-2 pt-4 border-t border-border/40">
                  {!isNew && (
                    <Button type="button" variant="outline" onClick={() => setIsEditing(false)} className="flex-1">
                      Cancelar
                    </Button>
                  )}
                  {isNew && (
                    <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                      Cancelar
                    </Button>
                  )}
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={form.formState.isSubmitting}
                  >
                    {form.formState.isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Salvar
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            /* ── View Mode (Projuris style) ── */
            <>
              {/* Detalhes da Tarefa */}
              <div>
                <h3 className="text-base font-bold text-foreground mb-4">Detalhes da Tarefa</h3>

                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-foreground">Título</p>
                    <p className="text-sm text-muted-foreground">{compromisso?.titulo || 'Não informado'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-foreground">Tipo da Tarefa</p>
                      <p className="text-sm text-muted-foreground">{compromisso?.tipo || 'Não informado'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Marcadores</p>
                      <p className="text-sm text-muted-foreground">Não informado</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs font-bold text-foreground">Data base</p>
                      <p className="text-sm text-muted-foreground">{getFormattedDate()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Data de conclusão prevista</p>
                      <p className="text-sm text-muted-foreground">{getFormattedDate()} - {getFormattedTime()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Data Fatal</p>
                      <p className="text-sm text-muted-foreground">{getFormattedDate()} - {getFormattedTime()}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-foreground">Local</p>
                    <p className="text-sm text-muted-foreground">Não informado</p>
                  </div>

                  {compromisso?.descricao && (
                    <div>
                      <p className="text-xs font-bold text-foreground">Descrição</p>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{compromisso.descricao}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Processo vinculado */}
              {compromisso?.processo_id && (
                <div className="border border-border/60 rounded-lg p-4 bg-muted/10">
                  <p className="text-xs font-bold text-foreground mb-1">Processo vinculado</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-primary font-medium">{compromisso.processo_id}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              )}

              {/* Collapsible Sections - Projuris style */}
              <CollapsibleSection icon={Clock} title="Timesheet"
                actions={<Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Adicionar</Button>}
              >
                <p className="text-sm text-muted-foreground">Nenhum registro de tempo adicionado.</p>
              </CollapsibleSection>

              <CollapsibleSection icon={FileText} title="Documentos"
                actions={
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Adicionar</Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs rounded-md">Usar modelo</Button>
                  </div>
                }
              >
                <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>
              </CollapsibleSection>

              <CollapsibleSection icon={CheckSquare} title="Checklist"
                actions={<Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Adicionar</Button>}
              >
                <p className="text-sm text-muted-foreground">Nenhum item no checklist.</p>
              </CollapsibleSection>

              <CollapsibleSection icon={ClipboardList} title="Tarefas relacionadas"
                actions={<Button size="sm" className="h-7 text-xs bg-emerald-500 hover:bg-emerald-600 text-white rounded-md">Adicionar</Button>}
              >
                <p className="text-sm text-muted-foreground">Nenhuma tarefa relacionada.</p>
              </CollapsibleSection>

              <CollapsibleSection icon={Clock} title="Auditoria">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Criado em: {compromisso?.created_at ? format(new Date(compromisso.created_at), 'dd/MM/yyyy HH:mm') : '—'}</p>
                  <p>Atualizado em: {compromisso?.updated_at ? format(new Date(compromisso.updated_at), 'dd/MM/yyyy HH:mm') : '—'}</p>
                </div>
              </CollapsibleSection>

              <CollapsibleSection icon={MessageSquare} title="Comentários" defaultOpen>
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">2000 caracteres restantes</p>
                  <Textarea
                    placeholder="Utilize o @ antes de um nome para citar outros usuários do sistema."
                    value={comentario}
                    onChange={e => setComentario(e.target.value)}
                    className="resize-none"
                    rows={3}
                    maxLength={2000}
                  />
                </div>
              </CollapsibleSection>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
