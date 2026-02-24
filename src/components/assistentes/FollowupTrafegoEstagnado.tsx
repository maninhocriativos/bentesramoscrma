import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Megaphone, Eye, Rocket, Loader2, Users, Clock, 
  CheckCircle2, XCircle, AlertTriangle, Upload, Image, Pencil, X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const DEFAULT_IMAGE_URL = 'https://bentesramoscrma.lovable.app/images/prova-social-bradesco.jpg';

const DEFAULT_MESSAGE = `Olá {nome}! Aqui é a *Isa do Bentes & Ramos* 🏛️

Passando para te lembrar que ainda estamos à disposição para te ajudar! 💼

Olha só essa decisão recente que conquistamos: um banco foi *condenado a pagar R$ 8.000,00* por cobrança indevida em contrato de financiamento. 🎉

Se você está enfrentando problemas com cobranças abusivas, empréstimos indevidos ou qualquer irregularidade bancária, *nós podemos te ajudar a buscar seus direitos*.

📩 Me responda aqui que eu te oriento sobre os próximos passos!`;

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
  const [editingMessage, setEditingMessage] = useState(false);
  const [mensagem, setMensagem] = useState(DEFAULT_MESSAGE);
  const [imagemUrl, setImagemUrl] = useState(DEFAULT_IMAGE_URL);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Selecione um arquivo de imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 5MB');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `followup-prova-social-${Date.now()}.${ext}`;
      const filePath = `campanhas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('documentos')
        .getPublicUrl(filePath);

      // For private buckets, use signed URL
      const { data: signedData, error: signedError } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 60 * 60 * 24 * 30); // 30 days

      const publicUrl = signedData?.signedUrl || urlData.publicUrl;
      setImagemUrl(publicUrl);
      setImagePreview(URL.createObjectURL(file));
      toast.success('Imagem carregada com sucesso');
    } catch (err: any) {
      toast.error('Erro ao carregar imagem: ' + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const executeDryRun = async () => {
    setLoading(true);
    setDryRunData(null);
    setCampaignResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('followup-trafego-estagnado', {
        body: { dry_run: true, dias_sem_contato: 7, mensagem_template: mensagem, imagem_url: imagemUrl },
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
        body: { dry_run: false, dias_sem_contato: 7, intervalo_minutos: 10, mensagem_template: mensagem, imagem_url: imagemUrl },
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
        {/* Image Section */}
        <div className="space-y-2">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <Image className="h-3.5 w-3.5" /> Imagem de prova social
          </Label>
          <div className="flex items-start gap-3">
            <div className="relative w-24 h-24 rounded-lg border overflow-hidden bg-muted flex-shrink-0">
              <img
                src={imagePreview || imagemUrl}
                alt="Prova social"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder.svg'; }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                {uploading ? 'Enviando...' : 'Trocar imagem'}
              </Button>
              <Input
                value={imagemUrl}
                onChange={(e) => { setImagemUrl(e.target.value); setImagePreview(null); }}
                placeholder="Ou cole a URL da imagem"
                className="text-xs h-8"
              />
            </div>
          </div>
        </div>

        {/* Message Editor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Pencil className="h-3.5 w-3.5" /> Mensagem de follow-up
            </Label>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setEditingMessage(!editingMessage)}
            >
              {editingMessage ? <><X className="h-3 w-3 mr-1" /> Fechar</> : <><Pencil className="h-3 w-3 mr-1" /> Editar</>}
            </Button>
          </div>
          {editingMessage ? (
            <div className="space-y-1.5">
              <Textarea
                value={mensagem}
                onChange={(e) => setMensagem(e.target.value)}
                rows={8}
                className="text-xs font-mono"
                placeholder="Use {nome} para inserir o primeiro nome do lead"
              />
              <p className="text-[10px] text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{nome}'}</code> para inserir o primeiro nome do lead. Use <code className="bg-muted px-1 rounded">*texto*</code> para negrito.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-muted-foreground"
                onClick={() => setMensagem(DEFAULT_MESSAGE)}
              >
                Restaurar padrão
              </Button>
            </div>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3 border">
              <p className="text-xs whitespace-pre-wrap line-clamp-4">{mensagem}</p>
            </div>
          )}
        </div>

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
