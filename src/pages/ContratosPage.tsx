import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ContratosKPIs } from '@/components/contratos/ContratosKPIs';
import { ContratosTable } from '@/components/contratos/ContratosTable';
import { ModelosContratos } from '@/components/contratos/ModelosContratos';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export interface ContratoClicksign {
  id: string;
  key: string;
  filename: string;
  status: string;
  created_at: string;
  updated_at: string;
  signers: Array<{
    key: string;
    email: string;
    name: string;
    signed_at: string | null;
  }>;
}

export interface ContratoComStatus {
  id: string;
  leadId?: string;
  leadNome: string;
  leadEmail: string | null;
  tipoAcao: string | null;
  linkContrato: string;
  status: string;
  lastUpdate: string | null;
  key?: string;
}

// Map Clicksign status to our status
const mapClicksignStatus = (doc: any): string => {
  if (doc.status === 'closed') return 'Finalizado';
  if (doc.status === 'canceled') return 'Cancelado';
  if (doc.status === 'running') {
    const signers = doc.signers || [];
    const allSigned = signers.length > 0 && signers.every((s: any) => s.signed_at);
    const anySigned = signers.some((s: any) => s.signed_at);
    
    if (allSigned) return 'Assinado';
    if (anySigned) return 'Assinatura Parcial';
    return 'Aguardando Assinatura';
  }
  return 'Documento Enviado';
};

export default function ContratosPage() {
  const { toast } = useToast();
  const [contratos, setContratos] = useState<ContratoComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');

  const fetchContractsFromClicksign = useCallback(async (showLoading = true, showToast = false) => {
    if (showLoading) setLoading(true);
    setRefreshing(!showLoading);
    
    try {
      const { data, error } = await supabase.functions.invoke('clicksign', {
        body: { action: 'list_documents', page: 1 },
      });

      if (error) {
        console.error('Error fetching from Clicksign:', error);
        throw error;
      }

      // Map Clicksign documents to our format
      const documents = data?.documents || [];
      const mappedContracts: ContratoComStatus[] = documents.map((doc: any) => ({
        id: doc.key,
        key: doc.key,
        leadNome: doc.filename?.replace(/\.[^/.]+$/, '') || 'Documento',
        leadEmail: doc.signers?.[0]?.email || null,
        tipoAcao: doc.path || null,
        linkContrato: `https://app.clicksign.com/documents/${doc.key}`,
        status: mapClicksignStatus(doc),
        lastUpdate: doc.updated_at || doc.created_at,
      }));

      // Sort by date
      mappedContracts.sort((a, b) => {
        if (a.lastUpdate && b.lastUpdate) {
          return new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime();
        }
        return 0;
      });

      setContratos(mappedContracts);
      
      if (showToast) {
        toast({
          title: 'Contratos atualizados',
          description: `${mappedContracts.length} documentos encontrados.`,
        });
      }
    } catch (error: any) {
      console.error('Error fetching contracts:', error);
      if (showToast) {
        toast({
          title: 'Erro ao buscar contratos',
          description: error.message || 'Não foi possível conectar ao Clicksign.',
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  // Fetch on mount and set up auto-refresh every 30 seconds
  useEffect(() => {
    fetchContractsFromClicksign();
    
    const interval = setInterval(() => {
      fetchContractsFromClicksign(false);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [fetchContractsFromClicksign]);

  const handleRefresh = () => {
    fetchContractsFromClicksign(false, true); // Manual refresh shows toast
  };

  const filteredContratos = contratos.filter(contrato => {
    switch (activeTab) {
      case 'em-processo':
        return ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(contrato.status);
      case 'finalizados':
        return ['Assinado', 'Finalizado'].includes(contrato.status);
      case 'cancelados':
        return ['Cancelado', 'Recusado', 'Prazo Expirado'].includes(contrato.status);
      default:
        return true;
    }
  });

  const kpiData = {
    emProcesso: contratos.filter(c => ['Aguardando Assinatura', 'Assinatura Parcial', 'Documento Enviado'].includes(c.status)).length,
    recusados: contratos.filter(c => c.status === 'Recusado').length,
    finalizados: contratos.filter(c => ['Assinado', 'Finalizado'].includes(c.status)).length,
    cancelados: contratos.filter(c => ['Cancelado', 'Prazo Expirado'].includes(c.status)).length,
    total: contratos.length,
  };

  return (
    <AppLayout>
      <AppHeader title="Contratos" />
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 space-y-6 animate-fade-in overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <ContratosKPIs data={kpiData} onRefresh={handleRefresh} refreshing={refreshing} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="todos">Todos ({contratos.length})</TabsTrigger>
                <TabsTrigger value="em-processo">Em Processo ({kpiData.emProcesso})</TabsTrigger>
                <TabsTrigger value="finalizados">Finalizados ({kpiData.finalizados})</TabsTrigger>
                <TabsTrigger value="cancelados">Cancelados ({kpiData.cancelados})</TabsTrigger>
                <TabsTrigger value="modelos">Modelos</TabsTrigger>
              </TabsList>

              <TabsContent value="todos">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="em-processo">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="finalizados">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="cancelados">
                <ContratosTable contratos={filteredContratos} />
              </TabsContent>
              <TabsContent value="modelos">
                <ModelosContratos />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}
