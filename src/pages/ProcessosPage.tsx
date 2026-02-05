import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { ProcessosTable } from '@/components/processos/ProcessosTable';
import { ProcessoModalExpanded } from '@/components/processos/ProcessoModalExpanded';
import { ConsultaProcessoExterno } from '@/components/processos/ConsultaProcessoExterno';
import { useProcessos } from '@/hooks/useProcessos';
import { usePerfil } from '@/hooks/usePerfil';
import { useLeads } from '@/hooks/useLeads';
import { Processo } from '@/types/processos';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ProcessosPage() {
  const navigate = useNavigate();
  const { processos, loading } = useProcessos();
  const { leads } = useLeads();
  const { canDelete, canAccessProcessos, loading: perfilLoading } = usePerfil();
  
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Redirect Gerente (who can't access processos) to dashboard
  useEffect(() => {
    if (!perfilLoading && !canAccessProcessos) {
      navigate('/dashboard');
    }
  }, [perfilLoading, canAccessProcessos, navigate]);

  // Show loading while checking permissions
  if (perfilLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Don't render if user can't access
  if (!canAccessProcessos) {
    return null;
  }

  const handleProcessoClick = (processo: Processo) => {
    setSelectedProcesso(processo);
    setIsNew(false);
    setIsModalOpen(true);
  };

  const handleNewProcesso = () => {
    setSelectedProcesso(null);
    setIsNew(true);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProcesso(null);
    setIsNew(false);
  };

  const filteredProcessos = processos.filter(p => {
    const search = searchTerm.toLowerCase();
    return (
      (p.numero_processo?.toLowerCase().includes(search)) ||
      (p.titulo_acao?.toLowerCase().includes(search)) ||
      (p.advogado_responsavel?.toLowerCase().includes(search))
    );
  });

  return (
    <AppLayout>
      <AppHeader 
        title="Processos" 
        onNewItem={handleNewProcesso}
        newItemLabel="Novo Processo"
      />
      
      <div className="flex-1 p-4 md:p-6 space-y-4 animate-fade-in">
        <Tabs defaultValue="internos" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="internos">Processos do Escritório</TabsTrigger>
            <TabsTrigger value="consulta">Consultar CNJ</TabsTrigger>
          </TabsList>

          <TabsContent value="internos" className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, título ou advogado..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 rounded-xl shadow-soft border-0"
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <ProcessosTable 
                processos={filteredProcessos} 
                onProcessoClick={handleProcessoClick}
                leads={leads}
              />
            )}
          </TabsContent>

          <TabsContent value="consulta">
            <ConsultaProcessoExterno />
          </TabsContent>
        </Tabs>
      </div>

      <ProcessoModalExpanded
        processo={selectedProcesso}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        isNew={isNew}
        canDelete={canDelete}
        leads={leads}
      />
    </AppLayout>
  );
}
