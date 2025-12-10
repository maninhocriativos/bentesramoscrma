import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export interface ModeloContrato {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  arquivo_url: string;
  arquivo_nome: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useModelosContratos() {
  const [modelos, setModelos] = useState<ModeloContrato[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchModelos = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('modelos_contratos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: 'Erro ao carregar modelos',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setModelos(data as ModeloContrato[]);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchModelos();
  }, [fetchModelos]);

  const uploadModelo = async (
    file: File,
    nome: string,
    descricao: string,
    categoria: string
  ) => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para fazer upload.',
        variant: 'destructive',
      });
      return null;
    }

    try {
      // Upload file to storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `modelos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('documentos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get signed URL (valid for 1 year)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('documentos')
        .createSignedUrl(filePath, 31536000); // 1 year in seconds

      if (urlError || !urlData) throw urlError || new Error('Failed to get signed URL');

      // Create record in database
      const { data, error } = await supabase
        .from('modelos_contratos')
        .insert({
          nome,
          descricao,
          categoria,
          arquivo_url: urlData.signedUrl,
          arquivo_nome: file.name,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Modelo enviado com sucesso!' });
      await fetchModelos();
      return data;
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar modelo',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }
  };

  const deleteModelo = async (id: string) => {
    const { error } = await supabase
      .from('modelos_contratos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: 'Erro ao excluir modelo',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    toast({ title: 'Modelo excluído!' });
    await fetchModelos();
    return true;
  };

  return {
    modelos,
    loading,
    fetchModelos,
    uploadModelo,
    deleteModelo,
  };
}
