import { useState } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import { ProcessosTable } from '@/components/processos/ProcessosTable';
import { ProcessoModal } from '@/components/processos/ProcessoModal';
import { useProcessos } from '@/hooks/useProcessos';
import { usePerfil } from '@/hooks/usePerfil';
import { useLeads } from '@/hooks/useLeads';
import { Processo } from '@/types/processos';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function ProcessosPage() {
  const { processos, loading } = useProcessos();
  const { leads } = useLeads();
  const { canDelete } = usePerfil();
  
  const [selectedProcesso, setSelectedProcesso] = useState<Processo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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
      
      <div className="flex-1 p-4 md:p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, título ou advogado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl"
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
      </div>

      <ProcessoModal
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
