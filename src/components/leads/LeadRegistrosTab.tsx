import { useState, useEffect, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, User, Calendar, Clock, NotebookPen } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface RegistroItem {
  id: string;
  resumo: string;
  data_interacao: string;
  responsavel_id: string | null;
  responsavelNome: string;
}

// Aba dedicada só a registros manuais do que aconteceu com o lead (ligação,
// decisão, observação) — separada da aba Histórico (que é o espelho
// automático de WhatsApp/mudanças de etapa) porque aqui o que importa é
// justamente poder validar depois QUEM registrou o quê e QUANDO, sem
// misturar com o volume de mensagens trocadas.
export function LeadRegistrosTab({ leadId }: { leadId: string }) {
  const { user } = useAuth();
  const [registros, setRegistros] = useState<RegistroItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*')
      .eq('cliente_id', leadId)
      .eq('tipo', 'Anotação')
      .order('data_interacao', { ascending: false });

    const responsavelIds = Array.from(new Set((interacoes || []).map(i => (i as any).responsavel_id).filter(Boolean)));
    let perfisPorId = new Map<string, string>();
    if (responsavelIds.length > 0) {
      const { data: perfis } = await supabase.from('perfis').select('id, nome, sobrenome').in('id', responsavelIds);
      perfisPorId = new Map((perfis || []).map((p: any) => [p.id, [p.nome, p.sobrenome].filter(Boolean).join(' ') || 'Equipe']));
    }

    setRegistros((interacoes || []).map((i: any) => ({
      id: i.id,
      resumo: i.resumo,
      data_interacao: i.data_interacao,
      responsavel_id: i.responsavel_id,
      responsavelNome: (i.responsavel_id && perfisPorId.get(i.responsavel_id)) || 'Equipe',
    })));
    setLoading(false);
  }, [leadId]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const handleAdd = async () => {
    if (!texto.trim()) return;
    setSalvando(true);
    const { error } = await supabase.from('interacoes').insert({
      cliente_id: leadId,
      tipo: 'Anotação',
      resumo: texto.trim(),
      data_interacao: new Date().toISOString(),
      responsavel_id: user?.id || null,
    });
    setSalvando(false);
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
      return;
    }
    setTexto('');
    await fetchRegistros();
    toast.success('Registrado');
  };

  const labelData = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <ScrollArea className="h-[62vh]">
      <div className="p-5 space-y-4">
        <div className="p-3 rounded-xl border border-border/60 bg-muted/30 space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <NotebookPen className="w-2.5 h-2.5" /> Novo registro
          </Label>
          <div className="flex items-end gap-2">
            <Textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Ligação, decisão, observação..."
              className="text-sm rounded-lg min-h-[40px] max-h-24 resize-none bg-background"
            />
            <Button size="sm" onClick={handleAdd} disabled={salvando || !texto.trim()} className="h-9 gap-1.5 text-xs rounded-lg shrink-0">
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Registrar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <NotebookPen className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum registro ainda</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Use o campo acima pra anotar o que aconteceu com este lead</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {registros.map(r => (
              <div key={r.id} className="p-3 rounded-xl border border-border/50 bg-card">
                <p className="text-sm text-foreground leading-relaxed break-words">{r.resumo}</p>
                <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1 font-medium text-foreground/70"><User className="h-3 w-3" /> {r.responsavelNome}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {labelData(r.data_interacao)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(r.data_interacao), 'HH:mm')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
