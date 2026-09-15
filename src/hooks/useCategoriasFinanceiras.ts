import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CategoriaFinanceira } from '@/types/financeiro';
import { useToast } from '@/hooks/use-toast';

export function useCategoriasFinanceiras() {
  const [categorias, setCategorias] = useState<CategoriaFinanceira[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchCategorias = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('categorias_financeiras' as any)
      .select('*')
      .order('tipo', { ascending: true })
      .order('ordem', { ascending: true });

    if (error) {
      toast({ title: 'Erro ao carregar categorias', description: error.message, variant: 'destructive' });
    } else {
      setCategorias(data as unknown as CategoriaFinanceira[]);
    }
    setLoading(false);
  }, [toast]);

  const createCategoria = async (categoria: Omit<CategoriaFinanceira, 'id' | 'created_at' | 'updated_at'>) => {
    const { data, error } = await supabase
      .from('categorias_financeiras' as any)
      .insert(categoria as any)
      .select()
      .single();

    if (error) {
      toast({ title: 'Erro ao criar categoria', description: error.message, variant: 'destructive' });
      return null;
    }

    toast({ title: 'Categoria criada!' });
    await fetchCategorias();
    return data;
  };

  const updateCategoria = async (id: string, updates: Partial<CategoriaFinanceira>) => {
    const { error } = await supabase
      .from('categorias_financeiras' as any)
      .update(updates as any)
      .eq('id', id);

    if (error) {
      toast({ title: 'Erro ao atualizar categoria', description: error.message, variant: 'destructive' });
      return false;
    }

    toast({ title: 'Categoria atualizada!' });
    await fetchCategorias();
    return true;
  };

  // Nunca apaga de verdade — categoria pode já estar referenciada em
  // honorários/despesas de meses passados, e um DELETE desclassificaria
  // esse histórico silenciosamente (a FK é ON DELETE SET NULL). Desativar
  // (ativa=false) tira do Select de novos lançamentos sem mexer no que já
  // existe.
  const desativarCategoria = async (id: string) => updateCategoria(id, { ativa: false });

  useEffect(() => {
    fetchCategorias();
  }, [fetchCategorias]);

  const categoriasAtivas = (tipo: 'receita' | 'despesa') =>
    categorias.filter(c => c.tipo === tipo && c.ativa);

  return { categorias, loading, fetchCategorias, createCategoria, updateCategoria, desativarCategoria, categoriasAtivas };
}
