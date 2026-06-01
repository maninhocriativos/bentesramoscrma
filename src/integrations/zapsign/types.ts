// Types para Zapsign API

export interface ZapsignDocument {
  id: string;
  name: string;
  status: 'pending' | 'signed' | 'rejected' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string;
  signers: ZapsignSigner[];
  expires_at?: string;
  metadata?: Record<string, any>;
}

export interface ZapsignSigner {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  status: 'pending' | 'signed' | 'rejected';
  signed_at?: string;
  sign_url?: string;
}

export interface CreateDocumentRequest {
  name: string;
  signers: Array<{
    name: string;
    email: string;
    phone?: string;
    cpf?: string;
  }>;
  file_url?: string;
  template_id?: string;
  expires_in_days?: number;
  metadata?: Record<string, any>;
}

export interface CreateDocumentResponse {
  id: string;
  name: string;
  status: string;
  signers: ZapsignSigner[];
  created_at: string;
}

export interface ListDocumentsResponse {
  documents: ZapsignDocument[];
  total: number;
  page: number;
  per_page: number;
}

export interface DocumentDetailsResponse extends ZapsignDocument {}

export interface WebhookPayload {
  event: 'document.created' | 'document.signed' | 'document.rejected' | 'document.expired' | 'signer.signed' | 'signer.rejected';
  document_id: string;
  document_name: string;
  signer_id?: string;
  signer_name?: string;
  signer_email?: string;
  timestamp: string;
  signature?: string; // HMAC signature para validação
}

export interface ZapsignError {
  code: string;
  message: string;
  details?: any;
}
