import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ModeloPeticao {
  id: string;
  nome: string;
  arquivo_url: string;
  variaveis: VariavelMapping[];
  created_at: string;
}

export interface VariavelMapping {
  textoOriginal: string;
  variavel: string;
}

export interface PeticaoGerada {
  id: string;
  modelo_id: string | null;
  cliente_nome: string | null;
  cliente_cpf_rg: string | null;
  cliente_endereco: string | null;
  valor_causa: string | null;
  parte_contraria: string | null;
  vara_comarca: string | null;
  informacoes_adicionais: string | null;
  arquivo_gerado_url: string | null;
  created_at: string;
  modelos_peticao?: { nome: string } | null;
}

export function useModelosPeticaoDocx() {
  const [modelos, setModelos] = useState<ModeloPeticao[]>([]);
  const [peticoesGeradas, setPeticoesGeradas] = useState<PeticaoGerada[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModelos = useCallback(async () => {
    const { data, error } = await supabase
      .from('modelos_peticao')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar modelos:', error);
      return;
    }
    setModelos((data || []).map(d => ({
      ...d,
      variaveis: (d.variaveis as unknown as VariavelMapping[]) || [],
    })));
  }, []);

  const fetchPeticoesGeradas = useCallback(async () => {
    const { data, error } = await supabase
      .from('peticoes_geradas')
      .select('*, modelos_peticao(nome)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar petições geradas:', error);
      return;
    }
    setPeticoesGeradas(data || []);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchModelos(), fetchPeticoesGeradas()]).finally(() => setLoading(false));
  }, [fetchModelos, fetchPeticoesGeradas]);

  const uploadModelo = async (nome: string, file: File, variaveis: VariavelMapping[]) => {
    const PizZip = (await import('pizzip')).default;
    const Docxtemplater = (await import('docxtemplater')).default;

    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];
    
    for (const xmlFile of xmlFiles) {
      try {
        let content = zip.file(xmlFile)?.asText();
        if (!content) continue;
        for (const v of variaveis) {
          if (v.textoOriginal && v.variavel) {
            const escaped = v.textoOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(new RegExp(escaped, 'g'), `{${v.variavel}}`);
          }
        }
        zip.file(xmlFile, content);
      } catch {
        // skip
      }
    }

    const processedBuffer = zip.generate({ type: 'arraybuffer' });
    const processedFile = new File([new Uint8Array(processedBuffer as ArrayBuffer)], file.name, { type: file.type });

    const filePath = `modelos/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('peticoes-modelos')
      .upload(filePath, processedFile);

    if (uploadError) {
      toast.error('Erro ao fazer upload do arquivo');
      throw uploadError;
    }

    const { error: insertError } = await supabase
      .from('modelos_peticao')
      .insert({
        nome,
        arquivo_url: filePath,
        variaveis: variaveis as unknown as Record<string, unknown>[],
      });

    if (insertError) {
      toast.error('Erro ao salvar modelo');
      throw insertError;
    }

    toast.success('Modelo salvo com sucesso!');
    await fetchModelos();
  };

  const deleteModelo = async (id: string, arquivoUrl: string) => {
    if (!arquivoUrl.startsWith('/templates/')) {
      await supabase.storage.from('peticoes-modelos').remove([arquivoUrl]);
    }
    const { error } = await supabase.from('modelos_peticao').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir modelo');
      return;
    }
    toast.success('Modelo excluído');
    await fetchModelos();
  };

  /**
   * Fetch the template file — supports both public paths (/templates/...) 
   * and Supabase Storage paths (modelos/...).
   */
  const fetchTemplateFile = async (arquivoUrl: string): Promise<ArrayBuffer | null> => {
    if (arquivoUrl.startsWith('/templates/')) {
      // Fetch from public directory
      const response = await fetch(arquivoUrl);
      if (!response.ok) {
        toast.error('Erro ao baixar modelo');
        return null;
      }
      return response.arrayBuffer();
    }
    // Fetch from Supabase Storage
    const { data, error } = await supabase.storage
      .from('peticoes-modelos')
      .download(arquivoUrl);
    if (error || !data) {
      toast.error('Erro ao baixar modelo');
      return null;
    }
    return data.arrayBuffer();
  };

  const gerarPeticao = async (
    modeloId: string,
    dados: Record<string, string>
  ): Promise<ArrayBuffer | null> => {
    const modelo = modelos.find(m => m.id === modeloId);
    if (!modelo) {
      toast.error('Modelo não encontrado');
      return null;
    }

    const arrayBuffer = await fetchTemplateFile(modelo.arquivo_url);
    if (!arrayBuffer) return null;

    const PizZip = (await import('pizzip')).default;
    const Docxtemplater = (await import('docxtemplater')).default;

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Set all template data from the form
    doc.setData(dados);

    try {
      doc.render();
    } catch (err) {
      console.error('Erro ao renderizar documento:', err);
      toast.error('Erro ao gerar documento');
      return null;
    }

    const output = doc.getZip().generate({ type: 'arraybuffer' }) as ArrayBuffer;

    // Upload generated file
    const clienteName = dados.NOME_COMPLETO || dados.cliente_nome || 'cliente';
    const fileName = `geradas/${Date.now()}_${clienteName.replace(/\s+/g, '_')}.docx`;
    const { error: uploadError } = await supabase.storage
      .from('peticoes-modelos')
      .upload(fileName, new Uint8Array(output));

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
    }

    // Save record
    const { error: insertError } = await supabase
      .from('peticoes_geradas')
      .insert({
        modelo_id: modeloId,
        cliente_nome: dados.NOME_COMPLETO || null,
        cliente_cpf_rg: dados.CPF || dados.RG || null,
        cliente_endereco: dados.ENDERECO_CLIENTE || null,
        valor_causa: null,
        parte_contraria: dados.REU_NOME || null,
        vara_comarca: dados.VARA_JUIZO || dados.COMARCA || null,
        informacoes_adicionais: null,
        arquivo_gerado_url: fileName,
      });

    if (insertError) {
      console.error('Erro ao salvar registro:', insertError);
    }

    await fetchPeticoesGeradas();
    toast.success('Petição gerada com sucesso!');
    return output;
  };

  const downloadPeticao = async (arquivoUrl: string, nomeCliente: string) => {
    const { data, error } = await supabase.storage
      .from('peticoes-modelos')
      .download(arquivoUrl);

    if (error || !data) {
      toast.error('Erro ao baixar arquivo');
      return null;
    }

    return data;
  };

  return {
    modelos,
    peticoesGeradas,
    loading,
    uploadModelo,
    deleteModelo,
    gerarPeticao,
    downloadPeticao,
    fetchModelos,
    fetchPeticoesGeradas,
  };
}
