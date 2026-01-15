import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { 
  Petition, 
  PetitionType, 
  PetitionDocument, 
  PetitionPayload 
} from '@/types/peticoes';

export function usePeticoes() {
  const [petitions, setPetitions] = useState<Petition[]>([]);
  const [petitionTypes, setPetitionTypes] = useState<PetitionType[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPetitionTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('petition_types')
      .select('*')
      .eq('enabled', true)
      .order('title');

    if (error) {
      console.error('Erro ao buscar tipos:', error);
      return;
    }

    setPetitionTypes(data as PetitionType[]);
  }, []);

  const fetchPetitions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('petitions')
      .select(`
        *,
        petition_types (slug, title, icon),
        leads_juridicos (nome)
      `)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar petições:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as petições',
        variant: 'destructive',
      });
    } else {
      setPetitions(data as unknown as Petition[]);
    }
    setLoading(false);
  }, [toast]);

  const createPetition = useCallback(async (
    typeSlug: string,
    leadId?: string
  ): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('petitions')
      .insert({
        petition_type_slug: typeSlug,
        lead_id: leadId || null,
        status: 'rascunho',
        step_current: 1,
        payload: {},
        created_by: user?.id,
        updated_by: user?.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar petição:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a petição',
        variant: 'destructive',
      });
      return null;
    }

    // Log de auditoria
    await supabase.from('petition_audit_log').insert({
      petition_id: data.id,
      action: 'created',
      actor: user?.email || 'sistema',
      meta: { type: typeSlug },
    });

    return data.id;
  }, [toast]);

  const updatePetition = useCallback(async (
    id: string,
    updates: Partial<Petition>
  ): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('petitions')
      .update({
        ...updates,
        updated_by: user?.id,
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar petição:', error);
      return false;
    }

    return true;
  }, []);

  const updatePayload = useCallback(async (
    id: string,
    payload: PetitionPayload,
    step?: number
  ): Promise<boolean> => {
    const updates: Partial<Petition> = { payload };
    if (step) updates.step_current = step;

    return updatePetition(id, updates);
  }, [updatePetition]);

  const getPetition = useCallback(async (id: string): Promise<Petition | null> => {
    const { data, error } = await supabase
      .from('petitions')
      .select(`
        *,
        petition_types (slug, title, icon, description),
        leads_juridicos (id, nome, email, telefone)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Erro ao buscar petição:', error);
      return null;
    }

    return data as unknown as Petition;
  }, []);

  const getDocuments = useCallback(async (petitionId: string): Promise<PetitionDocument[]> => {
    const { data, error } = await supabase
      .from('petition_documents')
      .select('*')
      .eq('petition_id', petitionId)
      .order('version', { ascending: false });

    if (error) {
      console.error('Erro ao buscar documentos:', error);
      return [];
    }

    return data as PetitionDocument[];
  }, []);

  const duplicatePetition = useCallback(async (id: string): Promise<string | null> => {
    const original = await getPetition(id);
    if (!original) return null;

    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('petitions')
      .insert({
        petition_type_slug: original.petition_type_slug,
        lead_id: original.lead_id,
        client_name: original.client_name,
        client_cpf: original.client_cpf,
        status: 'rascunho',
        step_current: 1,
        payload: original.payload,
        model_id: original.model_id,
        created_by: user?.id,
        updated_by: user?.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao duplicar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível duplicar a petição',
        variant: 'destructive',
      });
      return null;
    }

    toast({
      title: 'Sucesso',
      description: 'Petição duplicada com sucesso',
    });

    return data.id;
  }, [getPetition, toast]);

  const archivePetition = useCallback(async (id: string): Promise<boolean> => {
    const success = await updatePetition(id, { status: 'arquivado' });
    
    if (success) {
      toast({
        title: 'Arquivado',
        description: 'Petição arquivada com sucesso',
      });
      fetchPetitions();
    }
    
    return success;
  }, [updatePetition, fetchPetitions, toast]);

  const deletePetition = useCallback(async (id: string): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();

    // Excluir documentos relacionados primeiro
    await supabase
      .from('petition_documents')
      .delete()
      .eq('petition_id', id);

    // Excluir logs de auditoria
    await supabase
      .from('petition_audit_log')
      .delete()
      .eq('petition_id', id);

    // Excluir a petição
    const { error } = await supabase
      .from('petitions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir petição:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a petição',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Excluído',
      description: 'Petição excluída permanentemente',
    });

    fetchPetitions();
    return true;
  }, [fetchPetitions, toast]);

  useEffect(() => {
    fetchPetitionTypes();
    fetchPetitions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    petitions,
    petitionTypes,
    loading,
    fetchPetitions,
    createPetition,
    updatePetition,
    updatePayload,
    getPetition,
    getDocuments,
    duplicatePetition,
    archivePetition,
    deletePetition,
  };
}
