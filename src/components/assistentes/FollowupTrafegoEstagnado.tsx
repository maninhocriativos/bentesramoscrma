import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Megaphone, Eye, Rocket, Loader2, Users, Clock, 
  CheckCircle2, XCircle, AlertTriangle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DryRunResult {
  total_leads: number;
  dias_sem_contato: number;
  leads: Array<{
    nome: string;
    telefone: string;
    status: string;
    last_contact_at: string | null;
    fonte_trafego: string | null;
  }>;
  mensagem_exemplo: string;
  imagem_url: string;
}

interface CampaignResult {
  total: number;
  enviados: number;
  erros: number;
  results: Array<{ nome: string; telefone: string; success: boolean; error?: string }>;
}

export function FollowupTrafegoEstagnado() {
  const [loading, setLoading] = useState(false);
  const [dryRunData, setDryRunData] = useState<DryRunResult | null>(null);
  const [campaignResult, setCampaignResult] = useState<CampaignResult | null>(null);
  const [sending, setSending] = useState(false);

  const executeDryRun = async () => {
    setLoading(true);
    setDryRunData(null);
    setCampaignResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('followup-trafego-estagnado', {
        body: { dry_run: true, dias_sem_contato: 7 },
      });
      if (error) throw error;
      setDryRunData(data);
      toast.success(`${data.total_leads} leads encontrados`);
    } catch (err: any) {
      toast.error('Erro ao buscar leads: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const executeCampaign = async () => {
    if (!confirm(`Tem certeza que deseja enviar para ${dryRunData?.total_leads} leads? Esta ação não pode ser desfeita.`)) return;
    
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('followup-trafego-estagnado', {
        body: { dry_run: false, dias_sem_contato: 7, intervalo_minutos: 10 },
      });
      if (error) throw error;
      setCampaignResult(data);
      toast.success(`Campanha concluída: ${data.enviados} enviados`);
    } catch (err: any) {
      toast.error('Erro na campanha: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-orange-500" />
          Follow-up Tráfego Estagnado
          <Badge variant="outline" className="text-xs ml-auto">7+ dias sem contato</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Envia prova social (imagem + texto) para leads de tráfego pago sem interação há 7+ dias.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={executeDryRun}
            disabled={loading || sending}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Eye className="h-4 w-4 mr-1.5" />}
            Pré-visualizar
          </Button>
          {dryRunData && dryRunData.total_leads > 0 && (
            <Button
              size="sm"
              onClick={executeCampaign}
              disabled={sending}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Rocket className="h-4 w-4 mr-1.5" />}
              {sending ? 'Enviando...' : `Disparar para ${dryRunData.total_leads} leads`}
            </Button>
          )}
        </div>

        {/* Dry Run Results */}
        {dryRunData && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{dryRunData.total_leads}</span>
                <span className="text-muted-foreground">leads elegíveis</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Intervalo: 10 min entre envios</span>
              </div>
            </div>

            {/* Message Preview */}
            <div className="rounded-lg bg-muted/50 p-3 border">
              <p className="text-xs font-medium text-muted-foreground mb-1">📝 Mensagem de exemplo:</p>
              <p className="text-xs whitespace-pre-wrap">{dryRunData.mensagem_exemplo}</p>
            </div>

            {/* Lead List */}
            {dryRunData.leads.length > 0 && (
              <ScrollArea className="h-[200px]">
                <div className="space-y-1">
                  {dryRunData.leads.map((lead, i) => (
                    <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{lead.nome || 'Sem nome'}</span>
                        <span className="text-muted-foreground">{lead.telefone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{lead.status}</Badge>
                        {lead.fonte_trafego && (
                          <Badge variant="secondary" className="text-[10px]">{lead.fonte_trafego}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {dryRunData.total_leads === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-amber-500" />
                Nenhum lead de tráfego estagnado encontrado.
              </div>
            )}
          </div>
        )}

        {/* Campaign Results */}
        {campaignResult && (
          <div className="space-y-3 border-t pt-3">
            <h4 className="text-sm font-medium">Resultado da Campanha</h4>
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="font-medium">{campaignResult.enviados}</span> enviados
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="font-medium">{campaignResult.erros}</span> erros
              </div>
            </div>

            {campaignResult.results.filter(r => !r.success).length > 0 && (
              <ScrollArea className="h-[120px]">
                <div className="space-y-1">
                  {campaignResult.results.filter(r => !r.success).map((r, i) => (
                    <div key={i} className="text-xs text-red-500 flex items-center gap-1">
                      <XCircle className="h-3 w-3" />
                      {r.nome}: {r.error}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
