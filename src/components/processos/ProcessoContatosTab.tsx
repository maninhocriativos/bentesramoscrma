import { useState, useEffect, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Plus, Calendar, Clock, PhoneCall } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePerfil } from '@/contexts/PerfilContext';
import { toast } from 'sonner';

interface RegistroContato {
  id: string;
  resumo: string;
  data_interacao: string;
  responsavelNome: string;
}

function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return '?';
  return (partes[0][0] + (partes[1]?.[0] || '')).toUpperCase();
}

// Aba de contatos com o cliente DENTRO do processo (pedido do usuário
// 2026-09-12) — mesmo padrão de LeadRegistrosTab.tsx, mas escopado por
// processo_id em vez de cliente_id (a tabela `interacoes` já tinha essa
// coluna, só não era usada em lugar nenhum ainda). Guarda cliente_id
// também (quando o processo tem um vinculado) pra aparecer também no
// histórico do lead, sem duplicar linha nenhuma.
export function ProcessoContatosTab({ processoId, clienteId }: { processoId: string; clienteId: string | null }) {
  const { user } = useAuth();
  const { fullName } = usePerfil();
  const [registros, setRegistros] = useState<RegistroContato[]>([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const { data: interacoes } = await supabase
      .from('interacoes')
      .select('*')
      .eq('processo_id', processoId)
      .eq('tipo', 'Contato Processo')
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
      responsavelNome: (i.responsavel_id && i.responsavel_id === user?.id && fullName)
        || (i.responsavel_id && perfisPorId.get(i.responsavel_id))
        || 'Equipe',
    })));
    setLoading(false);
  }, [processoId, user?.id, fullName]);

  useEffect(() => { fetchRegistros(); }, [fetchRegistros]);

  const handleAdd = async () => {
    const conteudo = texto.trim();
    if (!conteudo || !user?.id) return;
    setSalvando(true);
    const { error } = await supabase.from('interacoes').insert({
      processo_id: processoId,
      cliente_id: clienteId,
      tipo: 'Contato Processo',
      resumo: conteudo,
      data_interacao: new Date().toISOString(),
      responsavel_id: user.id,
    });
    setSalvando(false);
    if (error) {
      toast.error('Erro ao registrar: ' + error.message);
      return;
    }
    setTexto('');
    await fetchRegistros();
    toast.success('Contato registrado');
  };

  const labelData = (iso: string) => {
    const d = new Date(iso);
    if (isToday(d)) return 'Hoje';
    if (isYesterday(d)) return 'Ontem';
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-5 space-y-4">
        <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
          <Label className="text-[10px] font-semibold text-primary uppercase tracking-wider flex items-center gap-1">
            <PhoneCall className="w-3 h-3" /> Novo contato com o cliente
          </Label>
          <div className="flex items-end gap-2">
            <Textarea
              value={texto}
              onChange={e => setTexto(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd(); }}
              placeholder="Ligação, WhatsApp, e-mail, presencial... o que foi tratado"
              className="text-sm rounded-lg min-h-[40px] max-h-28 resize-none bg-background"
            />
            <Button size="sm" onClick={handleAdd} disabled={salvando || !texto.trim() || !user?.id} className="h-9 gap-1.5 text-xs rounded-lg shrink-0 font-semibold">
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Registrar
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Fica registrado com seu nome, data e horário automaticamente. Ctrl+Enter pra enviar.</p>
        </div>

        {!loading && registros.length > 0 && (
          <p className="text-[10px] text-muted-foreground px-0.5">{registros.length} contato{registros.length !== 1 ? 's' : ''} registrado{registros.length !== 1 ? 's' : ''}</p>
        )}

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <PhoneCall className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-foreground">Nenhum contato registrado ainda</p>
            <p className="text-xs text-muted-foreground mt-1">Use o campo acima pra anotar uma ligação, mensagem ou reunião com o cliente sobre este processo</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {registros.map((r, i) => (
              <div key={r.id} className={i === 0 ? 'p-3.5 rounded-xl border border-primary/25 bg-primary/[0.03] shadow-sm' : 'p-3.5 rounded-xl border border-border/50 bg-card'}>
                <div className="flex items-start gap-2.5">
                  <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{iniciaisDe(r.responsavelNome)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-relaxed break-words">{r.resumo}</p>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground/80">{r.responsavelNome}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {labelData(r.data_interacao)}</span>
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(new Date(r.data_interacao), 'HH:mm')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
