import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { OfficeSettings } from '@/types/peticoes';

export function useOfficeSettings() {
  const [settings, setSettings] = useState<OfficeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('office_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar configurações:', error);
    }

    setSettings(data as OfficeSettings | null);
    setLoading(false);
  }, []);

  const updateSettings = useCallback(async (
    updates: Partial<OfficeSettings>
  ): Promise<boolean> => {
    if (!settings?.id) {
      // Criar novo registro
      const { error } = await supabase
        .from('office_settings')
        .insert(updates);

      if (error) {
        console.error('Erro ao criar configurações:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível salvar as configurações',
          variant: 'destructive',
        });
        return false;
      }
    } else {
      // Atualizar existente
      const { error } = await supabase
        .from('office_settings')
        .update(updates)
        .eq('id', settings.id);

      if (error) {
        console.error('Erro ao atualizar configurações:', error);
        toast({
          title: 'Erro',
          description: 'Não foi possível salvar as configurações',
          variant: 'destructive',
        });
        return false;
      }
    }

    toast({
      title: 'Sucesso',
      description: 'Configurações salvas com sucesso',
    });

    fetchSettings();
    return true;
  }, [settings, fetchSettings, toast]);

  const uploadLogo = useCallback(async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `office-logo-${Date.now()}.${fileExt}`;

    const { error: uploadError, data } = await supabase.storage
      .from('documentos')
      .upload(`office/${fileName}`, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
      toast({
        title: 'Erro',
        description: 'Não foi possível fazer upload da logo',
        variant: 'destructive',
      });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documentos')
      .getPublicUrl(`office/${fileName}`);

    return publicUrl;
  }, [toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    updateSettings,
    uploadLogo,
    refetch: fetchSettings,
  };
}
