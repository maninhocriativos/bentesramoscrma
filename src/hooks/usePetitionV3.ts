import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type PetitionCaseRow = Database['public']['Tables']['petition_cases']['Row'];
type PetitionCaseInsert = Database['public']['Tables']['petition_cases']['Insert'];
type PetitionCategoryRow = Database['public']['Tables']['petition_categories']['Row'];
type PetitionTypeRow = Database['public']['Tables']['petition_types_v3']['Row'];

export type PetitionCategory = PetitionCategoryRow;

export interface PetitionTypeV3 extends PetitionTypeRow {
  petition_categories?: PetitionCategory | null;
}

export interface PetitionCase extends PetitionCaseRow {
  petition_types_v3?: {
    nome: string;
    slug: string;
    icone: string | null;
    cor: string | null;
    petition_categories: { nome: string; slug: string } | null;
  } | null;
}

export function usePetitionV3() {
  const [categories, setCategories] = useState<PetitionCategory[]>([]);
  const [types, setTypes] = useState<PetitionTypeV3[]>([]);
  const [cases, setCases] = useState<PetitionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategories = useCallback(async () => {
    const { data, error } = await supabase
      .from('petition_categories')
      .select('*')
      .eq('ativo', true)
      .order('ordem');
    if (error) console.error('fetchCategories error:', error);
    setCategories(data || []);
  }, []);

  const fetchTypes = useCallback(async () => {
    const { data, error } = await supabase
      .from('petition_types_v3')
      .select('*, petition_categories(*)')
      .eq('ativo', true)
      .order('ordem');
    if (error) console.error('fetchTypes error:', error);
    setTypes((data || []) as unknown as PetitionTypeV3[]);
  }, []);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('petition_cases')
      .select('*, petition_types_v3(nome, slug, icone, cor, petition_categories(nome, slug))')
      .order('updated_at', { ascending: false });
    if (error) console.error('fetchCases error:', error);
    setCases((data || []) as unknown as PetitionCase[]);
    setLoading(false);
  }, []);

  const createCase = useCallback(async (typeId: string, initialData?: Partial<Record<string, unknown>>): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const petType = types.find(t => t.id === typeId);

    const insertData: PetitionCaseInsert = {
      petition_type_id: typeId,
      titulo: petType ? `${petType.nome} - Nova` : 'Nova Petição',
      status: 'rascunho',
      current_step: 1,
      created_by: user?.id ?? null,
    };

    // Merge safe fields from initialData
    if (initialData) {
      const safeKeys = [
        'cliente_nome','cliente_cpf','cliente_rg','cliente_nacionalidade','cliente_naturalidade',
        'cliente_estado_civil','cliente_profissao','cliente_data_nascimento','cliente_endereco',
        'cliente_bairro','cliente_cidade','cliente_uf','cliente_cep','cliente_telefone','cliente_email',
        'cliente_condicao_especial','reu_nome','reu_cnpj','reu_tipo','reu_endereco','reu_natureza_relacao',
        'comarca','estado','vara','tipo_vara','tramitacao_preferencial','fundamento_prioridade',
        'dados_faticos','pedir_tutela_urgencia','pedir_repeticao_indebito','pedir_danos_morais',
        'valor_dano_moral','pedir_inversao_onus','pedir_justica_gratuita','tentativa_administrativa',
        'desinteresse_conciliacao','observacoes_advogado','fatos_adicionais','titulo',
      ];
      for (const k of safeKeys) {
        if (initialData[k] !== undefined) {
          (insertData as Record<string, unknown>)[k] = initialData[k];
        }
      }
    }

    const { data, error } = await supabase
      .from('petition_cases')
      .insert(insertData)
      .select('id')
      .single();

    if (error) {
      console.error('createCase error:', error);
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      return null;
    }

    await supabase.from('petition_status_logs').insert({
      case_id: data.id,
      to_status: 'rascunho',
      changed_by: user?.id ?? null,
      reason: 'Caso criado',
    });

    return data.id;
  }, [types, toast]);

  const updateCase = useCallback(async (id: string, updates: Record<string, unknown>): Promise<boolean> => {
    // Filter to only valid DB columns
    const safeKeys = [
      'titulo','cliente_nome','cliente_cpf','cliente_rg','cliente_nacionalidade','cliente_naturalidade',
      'cliente_estado_civil','cliente_profissao','cliente_data_nascimento','cliente_endereco',
      'cliente_bairro','cliente_cidade','cliente_uf','cliente_cep','cliente_telefone','cliente_email',
      'cliente_condicao_especial','reu_nome','reu_cnpj','reu_tipo','reu_endereco','reu_natureza_relacao',
      'comarca','estado','vara','tipo_vara','tramitacao_preferencial','fundamento_prioridade',
      'dados_faticos','pedir_tutela_urgencia','pedir_repeticao_indebito','pedir_danos_morais',
      'valor_dano_moral','pedir_inversao_onus','pedir_justica_gratuita','tentativa_administrativa',
      'desinteresse_conciliacao','observacoes_advogado','fatos_adicionais',
    ];
    const safeUpdates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const k of safeKeys) {
      if (updates[k] !== undefined) safeUpdates[k] = updates[k];
    }

    const { error } = await supabase
      .from('petition_cases')
      .update(safeUpdates)
      .eq('id', id);
    if (error) {
      console.error('updateCase error:', error);
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
