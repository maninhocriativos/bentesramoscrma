import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { PetitionModel } from '@/types/peticoes';

export function usePetitionModels() {
  const [models, setModels] = useState<PetitionModel[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchModels = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('petition_models')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar modelos:', error);
    } else {
      setModels(data as PetitionModel[]);
    }
    setLoading(false);
  }, []);

  const uploadModel = useCallback(async (
    file: File,
    title: string,
    typeSlug: string
  ): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `model-${Date.now()}.${fileExt}`;

    // Upload do arquivo
    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(`modelos/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload do modelo',
        variant: 'destructive',
      });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documentos')
      .getPublicUrl(`modelos/${fileName}`);

    // Criar registro
    const { data, error } = await supabase
      .from('petition_models')
      .insert({
        title,
        petition_type_slug: typeSlug,
        file_url: publicUrl,
        file_type: fileExt as 'docx' | 'pdf',
        created_by: user?.id,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Erro ao criar modelo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar o modelo',
        variant: 'destructive',
      });
      return null;
    }

    toast({
      title: 'Sucesso',
      description: 'Modelo enviado! Processando extração de texto...',
    });

    // Chamar edge function para extrair texto
    try {
      await supabase.functions.invoke('extract-model-text', {
        body: { modelId: data.id },
      });
    } catch (e) {
      console.warn('Extração será feita em background');
    }

    fetchModels();
    return data.id;
  }, [fetchModels, toast]);

  const updateModel = useCallback(async (
    id: string,
    updates: Partial<PetitionModel>
  ): Promise<boolean> => {
    const { error } = await supabase
      .from('petition_models')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Erro ao atualizar modelo:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o modelo',
        variant: 'destructive',
      });
      return false;
    }

    fetchModels();
    return true;
  }, [fetchModels, toast]);

  const setAsDefault = useCallback(async (
    id: string,
    typeSlug: string
  ): Promise<boolean> => {
    // Remove default de outros modelos do mesmo tipo
    await supabase
      .from('petition_models')
      .update({ is_default: false })
      .eq('petition_type_slug', typeSlug);

    // Define o novo como default
    const success = await updateModel(id, { is_default: true });

    if (success) {
      toast({
        title: 'Sucesso',
        description: 'Modelo definido como padrão',
      });
    }

    return success;
  }, [updateModel, toast]);

  const deleteModel = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase
      .from('petition_models')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Erro ao excluir:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o modelo',
        variant: 'destructive',
      });
      return false;
    }

    toast({
      title: 'Sucesso',
      description: 'Modelo excluído',
    });

    fetchModels();
    return true;
  }, [fetchModels, toast]);

  const getDefaultModel = useCallback((typeSlug: string): PetitionModel | undefined => {
    return models.find(m => 
      m.petition_type_slug === typeSlug && 
      m.is_default && 
      m.is_active
    ) || models.find(m => 
      m.petition_type_slug === typeSlug && 
      m.is_active
    );
  }, [models]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return {
    models,
    loading,
    fetchModels,
    uploadModel,
    updateModel,
    setAsDefault,
    deleteModel,
    getDefaultModel,
  };
}
