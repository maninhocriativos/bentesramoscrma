import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ActionType {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  icone: string;
  cor: string;
  ativo: boolean;
  models_count?: number;
}

export interface PetitionModelV2 {
  id: string;
  action_type_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  tags: string[];
  template_file_url: string | null;
  preview_image_url: string | null;
  is_active: boolean;
  is_default: boolean;
  requires_bank_data: boolean;
  requires_financial_data: boolean;
  requires_contract_data: boolean;
  requires_special_requests: boolean;
  prompt_base: string | null;
  field_schema_json: Record<string, unknown>;
  version: string;
  action_types?: ActionType;
}

export interface PetitionV2 {
  id: string;
  action_type_id: string | null;
  model_id: string | null;
  cliente_id: string | null;
  status: 'draft' | 'review' | 'generated' | 'filed' | 'archived';
  form_data_json: Record<string, unknown>;
  generated_text_json: Record<string, unknown>;
  generated_docx_url: string | null;
  generated_pdf_url: string | null;
  current_step: number;
  include_procuracao: boolean;
  include_hipossuficiencia: boolean;
  include_honorarios: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // joins
  action_types?: ActionType;
  petition_models_v2?: PetitionModelV2;
}

export function usePeticoesV2() {
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [models, setModels] = useState<PetitionModelV2[]>([]);
  const [petitions, setPetitions] = useState<PetitionV2[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchActionTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('action_types')
      .select('*')
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar tipos de ação:', error);
      return;
    }
    setActionTypes((data || []) as ActionType[]);
  }, []);

  const fetchModels = useCallback(async () => {
    const { data, error } = await supabase
      .from('petition_models_v2')
      .select('*, action_types(*)')
      .eq('is_active', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar modelos:', error);
      return;
    }
    setModels((data || []) as unknown as PetitionModelV2[]);
  }, []);

  const fetchPetitions = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('petitions_v2')
      .select('*, action_types(*), petition_models_v2(nome, slug, tags)')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar petições:', error);
    } else {
      setPetitions((data || []) as unknown as PetitionV2[]);
    }
    setLoading(false);
  }, []);

  const createPetition = useCallback(async (
    actionTypeId: string,
    modelId: string,
    formData?: Record<string, unknown>
  ): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from('petitions_v2')
      .insert({
        action_type_id: actionTypeId,
        model_id: modelId,
        status: 'draft',
        current_step: 1,
        form_data_json: formData || {},
        created_by: user?.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar petição:', error);
      toast({ title: 'Erro', description: 'Não foi possível criar a petição', variant: 'destructive' });
      return null;
    }

    return (data as { id: string }).id;
  }, [toast]);

  const updatePetition = useCallback(async (
    id: string,
    updates: Partial<PetitionV2>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('petitions_v2')
      .update({ ...updates, updated_at: new Date().toISOString() } as Record<string, unknown>)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar petição:', error);
      return false;
    }
    return true;
  }, []);

  const saveDraft = useCallback(async (
    id: string,
    formData: Record<string, unknown>,
    step: number
  ): Promise<boolean> => {
    return updatePetition(id, {
      form_data_json: formData,
      current_step: step,
    } as Partial<PetitionV2>);
  }, [updatePetition]);

  const duplicatePetition = useCallback(async (id: string): Promise<string | null> => {
    const petition = petitions.find(p => p.id === id);
    if (!petition) return null;

    const newId = await createPetition(
      petition.action_type_id!,
      petition.model_id!,
      petition.form_data_json
    );

    if (newId) {
      toast({ title: 'Sucesso', description: 'Petição duplicada' });
      fetchPetitions();
    }
    return newId;
  }, [petitions, createPetition, fetchPetitions, toast]);

  const archivePetition = useCallback(async (id: string): Promise<boolean> => {
    const success = await updatePetition(id, { status: 'archived' } as Partial<PetitionV2>);
    if (success) {
      toast({ title: 'Arquivado', description: 'Petição arquivada com sucesso' });
      fetchPetitions();
    } else {
      toast({ title: 'Erro', description: 'Não foi possível arquivar a petição', variant: 'destructive' });
    }
    return success;
  }, [updatePetition, fetchPetitions, toast]);

  const deletePetition = useCallback(async (id: string): Promise<boolean> => {
    // RLS restringe DELETE em petitions_v2 a Administrador — sem .select(), uma
    // exclusão bloqueada pela política retorna error:null e 0 linhas afetadas
    // (comportamento padrão do Postgres/PostgREST), o que mostrava "Excluído" com
    // sucesso mesmo quando nada foi apagado de fato.
    const { data, error } = await supabase.from('petitions_v2').delete().eq('id', id).select('id');
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir', variant: 'destructive' });
      return false;
    }
    if (!data || data.length === 0) {
      toast({ title: 'Sem permissão', description: 'Apenas administradores podem excluir petições.', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Excluído', description: 'Petição excluída' });
    fetchPetitions();
    return true;
  }, [fetchPetitions, toast]);

  const getModelsForAction = useCallback((actionTypeId: string) => {
    return models.filter(m => m.action_type_id === actionTypeId);
  }, [models]);

  useEffect(() => {
    fetchActionTypes();
    fetchModels();
    fetchPetitions();
  }, [fetchActionTypes, fetchModels, fetchPetitions]);

  return {
    actionTypes,
    models,
    petitions,
    loading,
    fetchPetitions,
    createPetition,
    updatePetition,
    saveDraft,
    duplicatePetition,
    archivePetition,
    deletePetition,
    getModelsForAction,
  };
}
