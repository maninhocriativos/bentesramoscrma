// Hook da v2 (backend novo, Cloudflare) — mesma forma do usePeticoesV2.ts
// original (Supabase), pra a tela poder trocar de hook sem reescrever a UI.
// Fonte de dados: src/lib/peticoesV2Client.ts (Worker + D1 + R2, real).
import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import * as api from '@/lib/peticoesV2Client';
import type { ActionType, PetitionModelV2, PetitionV2 } from '@/lib/peticoesV2Client';

export type { ActionType, PetitionModelV2, PetitionV2 };

export function usePeticoesV2Client() {
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [models, setModels]           = useState<PetitionModelV2[]>([]);
  const [petitions, setPetitions]     = useState<PetitionV2[]>([]);
  const [loading, setLoading]         = useState(true);
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [at, m, p] = await Promise.all([
        api.fetchActionTypes(),
        api.fetchModels(),
        api.fetchPetitions(),
      ]);
      setActionTypes(at);
      setModels(m);
      setPetitions(p);
    } catch (err) {
      toast({ title: 'Erro ao carregar petições', description: err instanceof Error ? err.message : 'Erro desconhecido', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const duplicatePetition = useCallback(async (id: string) => {
    const newId = await api.duplicatePetition(id);
    if (newId) { toast({ title: 'Sucesso', description: 'Petição duplicada' }); await fetchAll(); }
    return newId;
  }, [fetchAll, toast]);

  const archivePetition = useCallback(async (id: string) => {
    await api.archivePetition(id);
    toast({ title: 'Arquivado', description: 'Petição arquivada com sucesso' });
    await fetchAll();
    return true;
  }, [fetchAll, toast]);

  const deletePetition = useCallback(async (id: string) => {
    await api.deletePetition(id);
    toast({ title: 'Excluído', description: 'Petição excluída' });
    await fetchAll();
    return true;
  }, [fetchAll, toast]);

  const getModelsForAction = useCallback((actionTypeId: string) => {
    return models.filter(m => m.action_type_id === actionTypeId);
  }, [models]);

  return {
    actionTypes, models, petitions, loading,
    fetchPetitions: fetchAll,
    duplicatePetition, archivePetition, deletePetition, getModelsForAction,
  };
}
