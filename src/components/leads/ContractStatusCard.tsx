import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileSignature, RefreshCw, ExternalLink, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContractStatusCardProps {
  leadId: string;
  linkContrato: string | null;
}

interface ContractStatus {
  status: string;
  signers?: Array<{
    email: string;
    name: string;
    signed_at: string | null;
  }>;
  document?: {
    filename: string;
    created_at: string;
  };
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'Documento Enviado': { label: 'Documento Enviado', color: 'bg-blue-100 text-blue-700', icon: <FileSignature className="h-4 w-4" /> },
  'Aguardando Assinatura': { label: 'Aguardando Assinatura', color: 'bg-amber-100 text-amber-700', icon: <Clock className="h-4 w-4" /> },
  'Assinatura Parcial': { label: 'Assinatura Parcial', color: 'bg-orange-100 text-orange-700', icon: <AlertCircle className="h-4 w-4" /> },
  'Assinado': { label: 'Assinado', color: 'bg-emerald-100 text-emerald-700', icon: <CheckCircle2 className="h-4 w-4" /> },
  'Finalizado': { label: 'Finalizado', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="h-4 w-4" /> },
  'Prazo Expirado': { label: 'Prazo Expirado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-4 w-4" /> },
  'Cancelado': { label: 'Cancelado', color: 'bg-gray-100 text-gray-700', icon: <XCircle className="h-4 w-4" /> },
  'Recusado': { label: 'Recusado', color: 'bg-red-100 text-red-700', icon: <XCircle className="h-4 w-4" /> },
};

export function ContractStatusCard({ leadId, linkContrato }: ContractStatusCardProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [contractStatus, setContractStatus] = useState<string | null>(null);
  const [lastInteraction, setLastInteraction] = useState<string | null>(null);

  // Extract document key from link_contrato if it contains a Clicksign URL
  const extractDocumentKey = (link: string | null): string | null => {
    if (!link) return null;
    // Try to extract Clicksign document key from URL or stored key
    const clicksignMatch = link.match(/clicksign\.com\/.*?([a-f0-9-]{36})/i);
    if (clicksignMatch) return clicksignMatch[1];
    // Check if it's a direct key
    if (link.match(/^[a-f0-9-]{36}$/i)) return link;
    return null;
  };

  const documentKey = extractDocumentKey(linkContrato);

  useEffect(() => {
    // Fetch the latest contract-related interaction
    const fetchContractStatus = async () => {
      const { data, error } = await supabase
        .from('interacoes')
        .select('resumo, created_at')
        .eq('cliente_id', leadId)
        .eq('tipo', 'Documento')
        .ilike('resumo', 'Contrato:%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        const statusMatch = data.resumo.match(/Contrato:\s*(.+)/);
        if (statusMatch) {
          setContractStatus(statusMatch[1].trim());
          setLastInteraction(data.created_at);
        }
      }
    };

    fetchContractStatus();
  }, [leadId]);

  const refreshStatus = async () => {
    if (!documentKey) {
      toast({
        title: 'Erro',
        description: 'Nenhum documento Clicksign vinculado a este lead.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('clicksign', {
        body: {
          action: 'get_document',
          document_key: documentKey,
        },
      });

      if (error) throw error;

      // Determine status from response
      const document = data?.document;
      if (document) {
        let newStatus = 'Documento Enviado';
        
        if (document.status === 'closed') {
          newStatus = 'Finalizado';
        } else if (document.status === 'canceled') {
          newStatus = 'Cancelado';
        } else if (document.signers?.length > 0) {
          const allSigned = document.signers.every((s: any) => s.signed_at);
          const anySigned = document.signers.some((s: any) => s.signed_at);
          
          if (allSigned) {
            newStatus = 'Assinado';
          } else if (anySigned) {
            newStatus = 'Assinatura Parcial';
          } else {
            newStatus = 'Aguardando Assinatura';
          }
        }

        setContractStatus(newStatus);
        toast({
          title: 'Status atualizado',
          description: `Status do contrato: ${newStatus}`,
        });
      }
    } catch (error: any) {
      console.error('Error fetching contract status:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Não foi possível atualizar o status do contrato.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const config = contractStatus ? statusConfig[contractStatus] : null;

  if (!linkContrato && !contractStatus) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <FileSignature className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Nenhum contrato vinculado</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-purple-600" />
            Status do Contrato
          </CardTitle>
          {documentKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshStatus}
              disabled={loading}
              className="h-8"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">Atualizar</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {config ? (
              <>
                <Badge className={`${config.color} flex items-center gap-1.5`}>
                  {config.icon}
                  {config.label}
                </Badge>
              </>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1.5">
                <FileSignature className="h-4 w-4" />
                Contrato vinculado
              </Badge>
            )}
          </div>
        </div>

        {lastInteraction && (
          <p className="text-xs text-muted-foreground">
            Última atualização: {new Date(lastInteraction).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {linkContrato && (
          <a
            href={linkContrato.startsWith('http') ? linkContrato : `https://app.clicksign.com/documents/${linkContrato}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Ver contrato no Clicksign
          </a>
        )}
      </CardContent>
    </Card>
  );
}
