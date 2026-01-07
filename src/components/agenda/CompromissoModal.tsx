import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Compromisso, TipoCompromisso } from '@/types/compromissos';
import { useCompromissos } from '@/hooks/useCompromissos';
import { Loader2, Trash2 } from 'lucide-react';

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

export function CompromissoModal({ isOpen, onClose, compromisso, selectedDate }: CompromissoModalProps) {
  const { createCompromisso, updateCompromisso, deleteCompromisso } = useCompromissos();

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

  const MANAUS_TZ = 'America/Manaus';

  useEffect(() => {
    if (compromisso) {
      // Converter UTC para horário de Manaus para exibição
      const dataUtc = new Date(compromisso.data_inicio);
      const dataManaus = toZonedTime(dataUtc, MANAUS_TZ);
      form.reset({
        titulo: compromisso.titulo,
        descricao: compromisso.descricao || '',
        data_inicio: format(dataManaus, 'yyyy-MM-dd'),
        hora_inicio: format(dataManaus, 'HH:mm'),
        tipo: compromisso.tipo as TipoCompromisso,
      });
    } else if (selectedDate) {
      const dataManaus = toZonedTime(selectedDate, MANAUS_TZ);
      form.reset({
        titulo: '',
        descricao: '',
        data_inicio: format(dataManaus, 'yyyy-MM-dd'),
        hora_inicio: '09:00',
        tipo: 'Reunião',
      });
    }
  }, [compromisso, selectedDate, form]);

  const onSubmit = async (data: FormData) => {
    // Converter horário de Manaus para UTC antes de salvar
    // O usuário digita 17:00 de Manaus, precisamos salvar como 21:00 UTC
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {compromisso ? 'Editar Compromisso' : 'Novo Compromisso'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="titulo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título</FormLabel>
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
                  <FormLabel>Tipo</FormLabel>
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
                    <FormLabel>Data</FormLabel>
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
                    <FormLabel>Hora</FormLabel>
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
                  <FormLabel>Descrição</FormLabel>
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

            <div className="flex gap-2 pt-4">
              {compromisso && (
                <Button 
                  type="button" 
                  variant="destructive" 
                  onClick={handleDelete}
                  className="flex-1"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
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
      </DialogContent>
    </Dialog>
  );
}
