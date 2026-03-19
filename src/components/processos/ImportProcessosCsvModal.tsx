import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ImportProcessosCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedProcesso {
  numero_processo: string;
  titulo_acao?: string;
  advogado_responsavel?: string;
  status?: string;
  tribunal?: string;
  assunto?: string;
  vara_comarca?: string;
  valor_causa?: number;
  cpf_cliente?: string;
  nome_cliente?: string;
  area?: string;
  fase?: string;
  descricao?: string;
}

type ImportStage = 'upload' | 'preview' | 'importing' | 'done';

export function ImportProcessosCsvModal({ isOpen, onClose }: ImportProcessosCsvModalProps) {
  const [stage, setStage] = useState<ImportStage>('upload');
  const [parsed, setParsed] = useState<ParsedProcesso[]>([]);
  const [fileName, setFileName] = useState('');
  const [results, setResults] = useState<{ inserted: number; skipped: number; errors: string[] }>({ inserted: 0, skipped: 0, errors: [] });
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage('upload');
    setParsed([]);
    setFileName('');
    setResults({ inserted: 0, skipped: 0, errors: [] });
    setImporting(false);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseCSV = (text: string): ParsedProcesso[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(/[;,]/).map(h => h.trim().toLowerCase().replace(/["\s]/g, '_').replace(/_+/g, '_'));

    const colMap: Record<string, string> = {
      'numero_processo': 'numero_processo',
      'numero': 'numero_processo',
      'cnj': 'numero_processo',
      'numero_cnj': 'numero_processo',
      'titulo': 'titulo_acao',
      'titulo_acao': 'titulo_acao',
      'classe': 'titulo_acao',
      'advogado': 'advogado_responsavel',
      'advogado_responsavel': 'advogado_responsavel',
      'responsavel': 'advogado_responsavel',
      'status': 'status',
      'situacao': 'status',
      'tribunal': 'tribunal',
      'assunto': 'assunto',
      'vara': 'vara_comarca',
      'vara_comarca': 'vara_comarca',
      'comarca': 'vara_comarca',
      'valor_causa': 'valor_causa',
      'valor': 'valor_causa',
      'cpf': 'cpf_cliente',
      'cpf_cliente': 'cpf_cliente',
      'area': 'area',
      'fase': 'fase',
      'descricao': 'descricao',
    };

    return lines.slice(1).map(line => {
      const values = line.split(/[;,]/).map(v => v.trim().replace(/^"|"$/g, ''));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        const mapped = colMap[h];
        if (mapped && values[i]) row[mapped] = values[i];
      });

      if (!row.numero_processo) return null;

      return {
        numero_processo: row.numero_processo,
        titulo_acao: row.titulo_acao || undefined,
        advogado_responsavel: row.advogado_responsavel || undefined,
        status: row.status || 'Em Andamento',
        tribunal: row.tribunal || undefined,
        assunto: row.assunto || undefined,
        vara_comarca: row.vara_comarca || undefined,
        valor_causa: row.valor_causa ? parseFloat(row.valor_causa.replace(/[^\d.,]/g, '').replace(',', '.')) : undefined,
        cpf_cliente: row.cpf_cliente || undefined,
        area: row.area || undefined,
        fase: row.fase || undefined,
        descricao: row.descricao || undefined,
      } as ParsedProcesso;
    }).filter(Boolean) as ParsedProcesso[];
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const items = parseCSV(text);
      if (items.length === 0) {
        toast.error('Nenhum processo válido encontrado no CSV');
        return;
      }
      setParsed(items);
      setStage('preview');
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleImport = async () => {
    setImporting(true);
    setStage('importing');
    const res = { inserted: 0, skipped: 0, errors: [] as string[] };

    for (const proc of parsed) {
      // Check duplicate by numero_processo
      const { data: existing } = await supabase
        .from('processos')
        .select('id')
        .eq('numero_processo', proc.numero_processo)
        .maybeSingle();

      if (existing) {
        res.skipped++;
        continue;
      }

      // Vincular cliente pelo CPF se disponível
      let clienteId: string | null = null;
      if (proc.cpf_cliente) {
        const cpfLimpo = proc.cpf_cliente.replace(/[^\d]/g, '');
        if (cpfLimpo.length >= 11) {
          const { data: lead } = await supabase
            .from('leads_juridicos')
            .select('id')
            .eq('cpf', proc.cpf_cliente)
            .maybeSingle();
          
          if (!lead) {
            // Tentar busca com CPF sem formatação
            const { data: lead2 } = await supabase
              .from('leads_juridicos')
              .select('id')
              .eq('cpf', cpfLimpo)
              .maybeSingle();
            clienteId = lead2?.id || null;
          } else {
            clienteId = lead.id;
          }
        }
      }

      const { error } = await supabase
        .from('processos')
        .insert({
          numero_processo: proc.numero_processo,
          titulo_acao: proc.titulo_acao || null,
          advogado_responsavel: proc.advogado_responsavel || null,
          status: proc.status || 'Em Andamento',
          tribunal: proc.tribunal || null,
          assunto: proc.assunto || null,
          vara_comarca: proc.vara_comarca || null,
          valor_causa: proc.valor_causa || null,
          cpf_cliente: proc.cpf_cliente || null,
          cliente_id: clienteId,
          area: proc.area || null,
          fase: proc.fase || null,
          descricao: proc.descricao || null,
        });

      if (error) {
        res.errors.push(`${proc.numero_processo}: ${error.message}`);
      } else {
        res.inserted++;
      }
    }

    setResults(res);
    setImporting(false);
    setStage('done');
    if (res.inserted > 0) {
      toast.success(`${res.inserted} processo(s) importado(s) com sucesso!`);
    }
  };

  const downloadTemplate = () => {
    const csv = 'numero_processo;titulo_acao;advogado_responsavel;status;tribunal;assunto;vara_comarca;valor_causa;cpf_cliente;area;fase;descricao\n0000000-00.0000.0.00.0000;Ação de Exemplo;Dr. Fulano;Em Andamento;TJAM;Cível;1ª Vara;10000.00;000.000.000-00;Cível;Conhecimento;Descrição do caso';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modelo-importacao-processos.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importar Processos via CSV
          </DialogTitle>
          <DialogDescription>
            Envie um arquivo CSV com os dados dos processos para importação em lote.
          </DialogDescription>
        </DialogHeader>

        {stage === 'upload' && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/20 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground">Clique para selecionar o arquivo CSV</p>
              <p className="text-xs text-muted-foreground mt-1">Separador: vírgula (,) ou ponto e vírgula (;)</p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <Button variant="outline" size="sm" onClick={downloadTemplate} className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Baixar modelo CSV
            </Button>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs font-medium text-foreground mb-1.5">Colunas aceitas:</p>
              <div className="flex flex-wrap gap-1.5">
                {['numero_processo', 'titulo_acao', 'advogado', 'status', 'tribunal', 'assunto', 'vara_comarca', 'valor_causa', 'cpf_cliente', 'area', 'fase', 'descricao'].map(c => (
                  <Badge key={c} variant="secondary" className="text-[10px] font-mono">{c}</Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {stage === 'preview' && (
          <div className="flex flex-col gap-4 min-h-0 flex-1">
            <div className="flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{fileName}</span>
              </div>
              <Badge variant="outline">{parsed.length} processos</Badge>
            </div>
            <div className="flex-1 min-h-0 max-h-[50vh] rounded-lg border border-border overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent">
              <div className="divide-y divide-border">
                {parsed.map((p, i) => (
                  <div key={i} className="px-4 py-2.5 flex items-start justify-between text-sm gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs">{p.numero_processo}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 whitespace-normal break-words">{p.titulo_acao || p.assunto || '—'}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">{p.status || 'Em Andamento'}</Badge>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end shrink-0">
              <Button variant="outline" onClick={reset}>Cancelar</Button>
              <Button onClick={handleImport}>
                <Upload className="h-4 w-4 mr-2" />
                Importar {parsed.length} processos
              </Button>
            </div>
          </div>
        )}

        {stage === 'importing' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm font-medium">Importando processos...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
          </div>
        )}

        {stage === 'done' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{results.inserted}</p>
                <p className="text-[10px] text-muted-foreground">Importados</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-700 dark:text-amber-400">{results.skipped}</p>
                <p className="text-[10px] text-muted-foreground">Duplicados</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-3">
                <X className="h-5 w-5 text-red-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-red-700 dark:text-red-400">{results.errors.length}</p>
                <p className="text-[10px] text-muted-foreground">Erros</p>
              </div>
            </div>
            {results.errors.length > 0 && (
              <ScrollArea className="h-32 rounded-lg border border-border p-2">
                {results.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-600 py-0.5">{e}</p>
                ))}
              </ScrollArea>
            )}
            <Button className="w-full" onClick={handleClose}>Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
