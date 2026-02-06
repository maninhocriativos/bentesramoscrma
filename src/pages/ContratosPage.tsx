import { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { ContratosKPIs } from '@/components/contratos/ContratosKPIs';
import { ContratosTable } from '@/components/contratos/ContratosTable';
import { ModelosContratos } from '@/components/contratos/ModelosContratos';
import { GerarContratoModal } from '@/components/contratos/GerarContratoModal';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText, FolderOpen, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

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

const TABS = [
  { id: 'todos', label: 'Todos', icon: FileText },
  { id: 'em-processo', label: 'Em Processo', icon: Clock },
  { id: 'finalizados', label: 'Finalizados', icon: CheckCircle2 },
  { id: 'cancelados', label: 'Cancelados', icon: XCircle },
  { id: 'modelos', label: 'Modelos', icon: FolderOpen },
];

export default function ContratosPage() {
  const { toast } = useToast();
  const [contratos, setContratos] = useState<ContratoComStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('todos');
  const [enviarModalOpen, setEnviarModalOpen] = useState(false);

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
        linkContrato: `https://app.clicksign.com/document/${doc.key}`,
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

  const getTabCount = (tabId: string) => {
    switch (tabId) {
      case 'todos': return contratos.length;
      case 'em-processo': return kpiData.emProcesso;
      case 'finalizados': return kpiData.finalizados;
      case 'cancelados': return kpiData.cancelados;
      case 'modelos': return null;
      default: return null;
    }
  };

  return (
    <AppLayout>
      <AppHeader title="Contratos" />
      
      <div className="flex-1 px-4 md:px-6 lg:px-8 py-4 space-y-4 md:space-y-6 animate-fade-in overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando contratos...</p>
          </div>
        ) : (
          <>
            <ContratosKPIs 
              data={kpiData} 
              onRefresh={handleRefresh} 
              onSendContract={() => setEnviarModalOpen(true)}
              refreshing={refreshing} 
            />

            {/* Custom Tabs */}
            <div className="space-y-4">
              {/* Tab Navigation */}
              <div className="flex gap-1 p-1 bg-muted/50 rounded-lg overflow-x-auto">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const count = getTabCount(tab.id);
                  const isActive = activeTab === tab.id;
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-all",
                        isActive 
                          ? "bg-background text-foreground shadow-sm" 
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{tab.label}</span>
                      {count !== null && (
                        <span className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full",
                          isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              {activeTab === 'modelos' ? (
                <ModelosContratos />
              ) : (
                <ContratosTable contratos={filteredContratos} />
              )}
            </div>
          </>
        )}
      </div>

      <GerarContratoModal 
        isOpen={enviarModalOpen}
        onClose={() => setEnviarModalOpen(false)}
        onSuccess={handleRefresh}
      />
    </AppLayout>
  );
}
