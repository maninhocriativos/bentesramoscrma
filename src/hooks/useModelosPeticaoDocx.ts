import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ModeloPeticao {
  id: string;
  nome: string;
  categoria: string | null;
  arquivo_url: string;
  marcadores: string[];
  variaveis: { textoOriginal: string; variavel: string }[];
  created_at: string;
}

export interface PeticaoGerada {
  id: string;
  modelo_id: string | null;
  nome_completo: string | null;
  qualificacao: string | null;
  rg: string | null;
  rg_militar: string | null;
  cpf: string | null;
  endereco_cliente: string | null;
  vara_juizo: string | null;
  comarca: string | null;
  reu_nome: string | null;
  reu_cnpj: string | null;
  reu_endereco: string | null;
  tipo_acao: string | null;
  idoso_idade: string | null;
  informacoes_adicionais: string | null;
  arquivo_gerado_url: string | null;
  created_at: string;
  // legacy columns
  cliente_nome: string | null;
  cliente_cpf_rg: string | null;
  cliente_endereco: string | null;
  parte_contraria: string | null;
  vara_comarca: string | null;
  modelos_peticao?: { nome: string } | null;
}

export interface VariavelMapping {
  textoOriginal: string;
  variavel: string;
}

export function useModelosPeticaoDocx() {
  const [modelos, setModelos] = useState<ModeloPeticao[]>([]);
  const [peticoesGeradas, setPeticoesGeradas] = useState<PeticaoGerada[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModelos = useCallback(async () => {
    const { data, error } = await supabase
      .from('modelos_peticao')
      .select('*')
      .order('nome', { ascending: true });
    if (error) {
      console.error('Erro ao buscar modelos:', error);
      return;
    }
    setModelos((data || []).map(d => ({
      ...d,
      categoria: (d as any).categoria || null,
      marcadores: ((d as any).marcadores as string[]) || [],
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
    setPeticoesGeradas((data || []) as unknown as PeticaoGerada[]);
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
      } catch { /* skip */ }
    }

    const processedBuffer = zip.generate({ type: 'arraybuffer' });
    const processedFile = new File([new Uint8Array(processedBuffer as ArrayBuffer)], file.name, { type: file.type });
    const filePath = `modelos/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('peticoes-modelos').upload(filePath, processedFile);
    if (uploadError) { toast.error('Erro ao fazer upload do arquivo'); throw uploadError; }

    const { error: insertError } = await supabase.from('modelos_peticao').insert({
      nome,
      arquivo_url: filePath,
      variaveis: variaveis as unknown as Record<string, unknown>[],
    });
    if (insertError) { toast.error('Erro ao salvar modelo'); throw insertError; }
    toast.success('Modelo salvo com sucesso!');
    await fetchModelos();
  };

  const deleteModelo = async (id: string, arquivoUrl: string) => {
    if (!arquivoUrl.startsWith('/templates/')) {
      await supabase.storage.from('peticoes-modelos').remove([arquivoUrl]);
    }
    const { error } = await supabase.from('modelos_peticao').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir modelo'); return; }
    toast.success('Modelo excluído');
    await fetchModelos();
  };

  const fetchTemplateFile = async (arquivoUrl: string): Promise<ArrayBuffer | null> => {
    if (arquivoUrl.startsWith('/templates/')) {
      const response = await fetch(arquivoUrl);
      if (!response.ok) { toast.error('Erro ao baixar modelo'); return null; }
      return response.arrayBuffer();
    }
    const { data, error } = await supabase.storage.from('peticoes-modelos').download(arquivoUrl);
    if (error || !data) { toast.error('Erro ao baixar modelo'); return null; }
    return data.arrayBuffer();
  };

  const gerarPeticao = async (
    modeloId: string,
    dados: Record<string, string>
  ): Promise<ArrayBuffer | null> => {
    const modelo = modelos.find(m => m.id === modeloId);
    if (!modelo) { toast.error('Modelo não encontrado'); return null; }

    const arrayBuffer = await fetchTemplateFile(modelo.arquivo_url);
    if (!arrayBuffer) return null;

    const PizZip = (await import('pizzip')).default;
    const Docxtemplater = (await import('docxtemplater')).default;

    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter: () => '',
    });

    doc.setData(dados);
    try { doc.render(); } catch (err) {
      console.error('Erro ao renderizar documento:', err);
      toast.error('Erro ao gerar documento');
      return null;
    }

    const output = doc.getZip().generate({ type: 'arraybuffer' }) as ArrayBuffer;

    // Upload generated file
    const clienteName = dados.NOME_COMPLETO || 'cliente';
    const fileName = `geradas/${Date.now()}_${clienteName.replace(/\s+/g, '_')}.docx`;
    const { error: uploadError } = await supabase.storage
      .from('peticoes-modelos')
      .upload(fileName, new Uint8Array(output));
    if (uploadError) console.error('Erro ao fazer upload:', uploadError);

    // Save record with all fields
    const { error: insertError } = await supabase.from('peticoes_geradas').insert({
      modelo_id: modeloId,
      nome_completo: dados.NOME_COMPLETO || null,
      qualificacao: dados.QUALIFICACAO || null,
      rg: dados.RG || null,
      rg_militar: dados.RG_MILITAR || null,
      cpf: dados.CPF || null,
      endereco_cliente: dados.ENDERECO_CLIENTE || null,
      vara_juizo: dados.VARA_JUIZO || null,
      comarca: dados.COMARCA || null,
      reu_nome: dados.REU_NOME || null,
      reu_cnpj: dados.REU_CNPJ || null,
      reu_endereco: dados.REU_ENDERECO || null,
      tipo_acao: dados.TIPO_ACAO || null,
      idoso_idade: dados.IDOSO_IDADE || null,
      informacoes_adicionais: dados.INFORMACOES_ADICIONAIS || null,
      // legacy
      cliente_nome: dados.NOME_COMPLETO || null,
      parte_contraria: dados.REU_NOME || null,
      vara_comarca: dados.VARA_JUIZO || null,
      arquivo_gerado_url: fileName,
    } as any);
    if (insertError) console.error('Erro ao salvar registro:', insertError);

    await fetchPeticoesGeradas();
    toast.success('Petição gerada com sucesso!');
    return output;
  };

  const downloadPeticao = async (arquivoUrl: string, _nomeCliente: string) => {
    const { data, error } = await supabase.storage.from('peticoes-modelos').download(arquivoUrl);
    if (error || !data) { toast.error('Erro ao baixar arquivo'); return null; }
    return data;
  };

  return {
    modelos, peticoesGeradas, loading,
    uploadModelo, deleteModelo, gerarPeticao, downloadPeticao,
    fetchModelos, fetchPeticoesGeradas,
  };
}
