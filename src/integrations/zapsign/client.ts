import { supabase } from '@/integrations/supabase/client';
import type {
  ZapsignDocument,
  CreateDocumentRequest,
  CreateDocumentResponse,
  ListDocumentsResponse,
  DocumentDetailsResponse,
  ZapsignError,
} from './types';

export class ZapsignClient {
  private apiUrl = 'https://api.zapsign.com.br';

  /**
   * Chama a edge function do Supabase que tem acesso aos secrets
   */
  private async callEdgeFunction<T>(action: string, body?: any): Promise<T> {
    const { data, error } = await supabase.functions.invoke('zapsign', {
      body: { action, ...body },
    });

    if (error) {
      throw new Error(`Zapsign API Error: ${error.message}`);
    }

    if (data?.error) {
      const zapsignError = data.error as ZapsignError;
      throw new Error(
        `Zapsign Error [${zapsignError.code}]: ${zapsignError.message}`
      );
    }

    return data as T;
  }

  /**
   * Listar documentos
   */
  async listDocuments(page = 1, perPage = 20): Promise<ListDocumentsResponse> {
    return this.callEdgeFunction<ListDocumentsResponse>('list_documents', {
      page,
      per_page: perPage,
    });
  }

  /**
   * Obter detalhes de um documento
   */
  async getDocumentDetails(documentId: string): Promise<DocumentDetailsResponse> {
    return this.callEdgeFunction<DocumentDetailsResponse>('get_document', {
      document_id: documentId,
    });
  }

  /**
   * Criar novo documento
   */
  async createDocument(
    request: CreateDocumentRequest
  ): Promise<CreateDocumentResponse> {
    return this.callEdgeFunction<CreateDocumentResponse>('create_document', {
      name: request.name,
      signers: request.signers,
      file_url: request.file_url,   // edge function converte para url_pdf
      expires_in_days: request.expires_in_days || 7,
      metadata: request.metadata,
    });
  }

  /**
   * Enviar documento para assinatura
   */
  async sendDocument(documentId: string): Promise<{ success: boolean }> {
    return this.callEdgeFunction<{ success: boolean }>('send_document', {
      document_id: documentId,
    });
  }

  /**
   * Cancelar documento
   */
  async cancelDocument(documentId: string): Promise<{ success: boolean }> {
    return this.callEdgeFunction<{ success: boolean }>('cancel_document', {
      document_id: documentId,
    });
  }

  /**
   * Obter link de assinatura para um signatário
   */
  async getSignUrl(
    documentId: string,
    signerId: string
  ): Promise<{ sign_url: string }> {
    return this.callEdgeFunction<{ sign_url: string }>('get_sign_url', {
      document_id: documentId,
      signer_id: signerId,
    });
  }

  /**
   * Validar assinatura (Background Check)
   */
  async validateSignature(
    documentId: string,
    signerId: string,
    cpf: string
  ): Promise<{ status: 'approved' | 'rejected' | 'pending' }> {
    return this.callEdgeFunction<{
      status: 'approved' | 'rejected' | 'pending';
    }>('validate_signature', {
      document_id: documentId,
      signer_id: signerId,
      cpf,
    });
  }
}

// Export singleton
export const zapsignClient = new ZapsignClient();
