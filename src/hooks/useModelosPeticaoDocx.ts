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

const VARIAVEIS_PADRAO = [
  { variavel: 'NOME_CLIENTE', label: 'Nome do Cliente' },
  { variavel: 'CPF_RG', label: 'CPF / RG' },
  { variavel: 'ENDERECO', label: 'Endereço' },
  { variavel: 'VALOR_CAUSA', label: 'Valor da Causa' },
  { variavel: 'PARTE_CONTRARIA', label: 'Parte Contrária' },
  { variavel: 'VARA_COMARCA', label: 'Vara / Comarca' },
  { variavel: 'INFORMACOES_ADICIONAIS', label: 'Informações Adicionais' },
];

export { VARIAVEIS_PADRAO };

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
    // Process the docx to replace mapped text with template variables
    const PizZip = (await import('pizzip')).default;
    const Docxtemplater = (await import('docxtemplater')).default;

    const arrayBuffer = await file.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Get the full text to do find & replace
    const xmlFiles = ['word/document.xml', 'word/header1.xml', 'word/header2.xml', 'word/header3.xml', 'word/footer1.xml', 'word/footer2.xml', 'word/footer3.xml'];
    
    for (const xmlFile of xmlFiles) {
      try {
        let content = zip.file(xmlFile)?.asText();
        if (!content) continue;
        
        for (const v of variaveis) {
          if (v.textoOriginal && v.variavel) {
            // Replace the original text with the template variable in the XML
            // We need to handle the case where Word splits text across XML runs
            const escaped = v.textoOriginal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            content = content.replace(new RegExp(escaped, 'g'), `{${v.variavel}}`);
          }
        }
        
        zip.file(xmlFile, content);
      } catch {
        // File doesn't exist in the zip, skip
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

    const { data: urlData } = supabase.storage
      .from('peticoes-modelos')
      .getPublicUrl(filePath);

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
    await supabase.storage.from('peticoes-modelos').remove([arquivoUrl]);
    const { error } = await supabase.from('modelos_peticao').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao excluir modelo');
      return;
    }
    toast.success('Modelo excluído');
    await fetchModelos();
  };

  const gerarPeticao = async (
    modeloId: string,
    dados: {
      cliente_nome: string;
      cliente_cpf_rg: string;
      cliente_endereco: string;
      valor_causa: string;
      parte_contraria: string;
      vara_comarca: string;
      informacoes_adicionais: string;
    }
  ): Promise<ArrayBuffer | null> => {
    const modelo = modelos.find(m => m.id === modeloId);
    if (!modelo) {
      toast.error('Modelo não encontrado');
      return null;
    }

    // Download template from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('peticoes-modelos')
      .download(modelo.arquivo_url);

    if (downloadError || !fileData) {
      toast.error('Erro ao baixar modelo');
      return null;
    }

    const PizZip = (await import('pizzip')).default;
    const Docxtemplater = (await import('docxtemplater')).default;

    const arrayBuffer = await fileData.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });

    // Set template data
    doc.setData({
      NOME_CLIENTE: dados.cliente_nome,
      CPF_RG: dados.cliente_cpf_rg,
      ENDERECO: dados.cliente_endereco,
      VALOR_CAUSA: dados.valor_causa,
      PARTE_CONTRARIA: dados.parte_contraria,
      VARA_COMARCA: dados.vara_comarca,
      INFORMACOES_ADICIONAIS: dados.informacoes_adicionais,
    });

    try {
      doc.render();
    } catch (err) {
      console.error('Erro ao renderizar documento:', err);
      toast.error('Erro ao gerar documento');
      return null;
    }

    const output = doc.getZip().generate({ type: 'arraybuffer' }) as ArrayBuffer;

    // Upload generated file
    const fileName = `geradas/${Date.now()}_${dados.cliente_nome.replace(/\s+/g, '_')}.docx`;
    const { error: uploadError } = await supabase.storage
      .from('peticoes-modelos')
      .upload(fileName, output);

    if (uploadError) {
      console.error('Erro ao fazer upload:', uploadError);
    }

    // Save record
    const { error: insertError } = await supabase
      .from('peticoes_geradas')
      .insert({
        modelo_id: modeloId,
        cliente_nome: dados.cliente_nome,
        cliente_cpf_rg: dados.cliente_cpf_rg,
        cliente_endereco: dados.cliente_endereco,
        valor_causa: dados.valor_causa,
        parte_contraria: dados.parte_contraria,
        vara_comarca: dados.vara_comarca,
        informacoes_adicionais: dados.informacoes_adicionais,
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
