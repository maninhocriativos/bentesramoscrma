import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Documento } from '@/types/documentos';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export function useDocumentos(processoId?: string, clienteId?: string) {
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchDocumentos = async () => {
    setLoading(true);
    let query = supabase
      .from('documentos')
      .select('*')
      .order('created_at', { ascending: false });

    if (processoId) {
      query = query.eq('processo_id', processoId);
    }
    if (clienteId) {
      query = query.eq('cliente_id', clienteId);
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: 'Erro ao carregar documentos', description: error.message, variant: 'destructive' });
    } else {
      setDocumentos(data as Documento[]);
    }
    setLoading(false);
  };

  const uploadDocumento = async (
    file: File,
    metadata: {
      nome: string;
      tipo: Documento['tipo'];
      descricao?: string;
      processo_id?: string;
      cliente_id?: string;
    }
  ) => {
    setUploading(true);
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${user?.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(filePath, file);

    if (uploadError) {
      toast({ title: 'Erro ao fazer upload', description: uploadError.message, variant: 'destructive' });
      setUploading(false);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documentos')
      .getPublicUrl(filePath);

    const { data, error } = await supabase
      .from('documentos')
      .insert({
        nome: metadata.nome,
        tipo: metadata.tipo,
        descricao: metadata.descricao || null,
        processo_id: metadata.processo_id || null,
        cliente_id: metadata.cliente_id || null,
        arquivo_url: publicUrl,
        arquivo_nome: file.name,
        arquivo_tamanho: file.size,
        uploaded_by: user?.id,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao salvar documento', description: error.message, variant: 'destructive' });
      setUploading(false);
      return null;
    }

    toast({ title: 'Documento enviado com sucesso!' });
    await fetchDocumentos();
    setUploading(false);
    return data;
  };

  const deleteDocumento = async (id: string, arquivoUrl: string) => {
    // Extract file path from URL
    const urlParts = arquivoUrl.split('/documentos/');
    if (urlParts.length > 1) {
      const filePath = urlParts[1];
      await supabase.storage.from('documentos').remove([filePath]);
    }

    const { error } = await supabase
      .from('documentos')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao excluir documento', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Documento excluído!' });
    await fetchDocumentos();
    return true;
  };

  useEffect(() => {
    fetchDocumentos();
  }, [processoId, clienteId]);

  return { documentos, loading, uploading, fetchDocumentos, uploadDocumento, deleteDocumento };
}
