export interface Documento {
  id: string;
  processo_id: string | null;
  cliente_id: string | null;
  nome: string;
  tipo: 'Petição' | 'Contrato' | 'Procuração' | 'Documento Pessoal' | 'Comprovante' | 'Outros';
  descricao: string | null;
  arquivo_url: string;
  arquivo_nome: string;
  arquivo_tamanho: number | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}
