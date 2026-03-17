import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PetitionCategory {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  icone: string;
  cor: string;
  ordem: number;
  ativo: boolean;
}

export interface PetitionTypeV3 {
  id: string;
  category_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  icone: string;
  cor: string;
  field_schema: Record<string, boolean>;
  agent_prompt: string | null;
  agent_model: string | null;
  template_docx_url: string | null;
  ativo: boolean;
  ordem: number;
  petition_categories?: PetitionCategory;
}

export interface PetitionCase {
  id: string;
  petition_type_id: string;
  titulo: string | null;
  status: string;
  cliente_nome: string | null;
  cliente_cpf: string | null;
  reu_nome: string | null;
  comarca: string | null;
  generated_content: Record<string, unknown> | null;
  generated_docx_url: string | null;
  generated_pdf_url: string | null;
  current_step: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  petition_types_v3?: PetitionTypeV3;
  [key: string]: unknown;
}

export function usePetitionV3() {
  const [categories, setCategories] = useState<PetitionCategory[]>([]);
  const [types, setTypes] = useState<PetitionTypeV3[]>([]);
  const [cases, setCases] = useState<PetitionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    const { data } = await supabase
      .from('petition_categories')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    setCategories((data || []) as PetitionCategory[]);
  }, []);

  const fetchTypes = useCallback(async () => {
    const { data } = await supabase
      .from('petition_types_v3')
      .select('*, petition_categories(*)')
      .eq('ativo', true)
      .order('ordem');
    setTypes((data || []) as unknown as PetitionTypeV3[]);
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('petition_cases')
      .select('*, petition_types_v3(nome, slug, icone, cor, petition_categories(nome, slug))')
      .order('updated_at', { ascending: false });
    setCases((data || []) as unknown as PetitionCase[]);
    setLoading(false);
  }, []);

  const createCase = useCallback(async (typeId: string, initialData?: Partial<PetitionCase>): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const petType = types.find(t => t.id === typeId);

    const { data, error } = await supabase
      .from('petition_cases')
      .insert({
        petition_type_id: typeId,
        titulo: petType ? `${petType.nome} - Nova` : 'Nova Petição',
        status: 'rascunho',
        current_step: 1,
        created_by: user?.id,
        ...initialData,
      } as Record<string, unknown>)
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível criar o caso', variant: 'destructive' });
      return null;
    }

    // Log status
    await supabase.from('petition_status_logs').insert({
      case_id: (data as { id: string }).id,
      to_status: 'rascunho',
      changed_by: user?.id,
      reason: 'Caso criado',
    });

    return (data as { id: string }).id;
  }, [types, toast]);

  const updateCase = useCallback(async (id: string, updates: Record<string, unknown>): Promise<boolean> => {
    const { error } = await supabase
      .from('petition_cases')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('Erro ao atualizar caso:', error);
      return false;
    }
    return true;
  }, []);

  const generatePetition = useCallback(async (caseId: string): Promise<Record<string, unknown> | null> => {
    const { data, error } = await supabase.functions.invoke('petition-generate-v3', {
      body: { case_id: caseId },
    });

    if (error) {
      toast({ title: 'Erro na geração', description: error.message, variant: 'destructive' });
      return null;
    }

    if (data?.error) {
      toast({ title: 'Erro na geração', description: data.error, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Petição gerada!', description: `Versão ${data.version} criada com sucesso.` });
    await fetchCases();
    return data.content;
  }, [toast, fetchCases]);

  const deleteCase = useCallback(async (id: string): Promise<boolean> => {
    // Delete versions and logs first
    await supabase.from('petition_generation_versions').delete().eq('case_id', id);
    await supabase.from('petition_status_logs').delete().eq('case_id', id);
    const { error } = await supabase.from('petition_cases').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro', description: 'Não foi possível excluir', variant: 'destructive' });
      return false;
    }
    toast({ title: 'Excluído' });
    await fetchCases();
    return true;
  }, [toast, fetchCases]);

  const getTypesForCategory = useCallback((categoryId: string) => {
    return types.filter(t => t.category_id === categoryId);
  }, [types]);

  useEffect(() => {
    fetchCategories();
    fetchTypes();
    fetchCases();
  }, [fetchCategories, fetchTypes, fetchCases]);

  return {
    categories, types, cases, loading,
    fetchCases, createCase, updateCase, generatePetition, deleteCase, getTypesForCategory,
  };
}
