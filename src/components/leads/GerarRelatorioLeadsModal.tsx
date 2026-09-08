import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, Loader2, ExternalLink, CheckCheck, Square } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lead } from '@/types/leads';

interface GerarRelatorioLeadsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leads: Lead[];
}

export function GerarRelatorioLeadsModal({ open, onOpenChange, leads }: GerarRelatorioLeadsModalProps) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set(leads.map(l => l.id)));
      setResultUrl(null);
    }
  }, [open, leads]);

  const toggleLead = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev => (prev.size === leads.length ? new Set() : new Set(leads.map(l => l.id))));
  };

  const handleGerar = async () => {
    if (selectedIds.size === 0) {
      toast({ title: 'Selecione ao menos um lead', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('leads-relatorio-sheets', {
        body: { leadIds: Array.from(selectedIds) },
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Erro ao gerar relatório', description: data.error, variant: 'destructive' });
        return;
      }
      setResultUrl(data.url);
      toast({ title: 'Planilha gerada!', description: `${data.total} lead(s) incluído(s).` });
    } catch (e) {
      console.error(e);
      toast({ title: 'Erro ao gerar relatório', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Gerar Relatório de Leads
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          A lista abaixo já reflete os filtros ativos na tela. Marque quais leads devem
          entrar na planilha do Google Sheets.
        </p>

        <div className="flex items-center justify-between">
          <Badge variant="secondary">{selectedIds.size} de {leads.length} selecionado(s)</Badge>
          <Button variant="ghost" size="sm" onClick={toggleAll} className="gap-1.5 text-xs">
            {selectedIds.size === leads.length ? <Square className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
            {selectedIds.size === leads.length ? 'Desmarcar todos' : 'Selecionar todos'}
          </Button>
        </div>

        <div className="border rounded-lg max-h-72 overflow-y-auto divide-y">
          {leads.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3">Nenhum lead na lista filtrada.</p>
          ) : (
            leads.map(lead => (
              <label key={lead.id} className="flex items-center gap-2.5 p-2.5 text-xs cursor-pointer hover:bg-muted/40">
                <Checkbox checked={selectedIds.has(lead.id)} onCheckedChange={() => toggleLead(lead.id)} />
                <span className="font-medium truncate flex-1">{lead.nome}</span>
                <span className="text-muted-foreground shrink-0">{lead.telefone}</span>
              </label>
            ))
          )}
        </div>

        {resultUrl ? (
          <Button asChild className="w-full gap-2">
            <a href={resultUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir Planilha
            </a>
          </Button>
        ) : (
          <Button onClick={handleGerar} disabled={loading || selectedIds.size === 0} className="w-full gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
            Gerar Planilha
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
