// Cliente de dados do módulo de Petições — backend real (Cloudflare Worker +
// D1 + R2, ver D:\crm-bentes_ramos\peticoes-cloudflare). O CRM só CONSOME
// (lista tipos de ação/modelos e gera petições) — cadastro de tipo de ação e
// de modelo (upload do .docx) é feito só no site standalone
// peticoes-modelos-admin.bentesramos.workers.dev. Rotas de action-types/
// models são públicas; rotas de petitions exigem o token de serviço
// (peticoesAuthBridge).
import { getPeticoesToken } from './peticoesAuthBridge';

const WORKER_URL = 'https://peticoes-poc.bentesramos.workers.dev';

export interface ActionType {
  id: string;
  slug: string;
  nome: string;
  descricao: string | null;
  icone: string;
  cor: string;
  ativo: boolean;
}

export interface PrintSlot { label: string; media_target: string }

export interface PetitionModelV2 {
  id: string;
  action_type_id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  tags: string[];
  template_r2_key: string | null;
  is_active: boolean;
  is_default: boolean;
  print_slots_json: PrintSlot[] | null;
}

export interface PetitionV2 {
  id: string;
  action_type_id: string | null;
  model_id: string | null;
  status: 'draft' | 'review' | 'generated' | 'filed' | 'archived';
  form_data_json: Record<string, unknown>;
  current_step: number;
  generated_r2_key: string | null;
  created_at: string;
  updated_at: string;
  action_types?: ActionType;
  petition_models?: PetitionModelV2;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${WORKER_URL}${path}`, init);
  const data = await resp.json();
  if (!resp.ok) throw new Error((data as { error?: string })?.error || `Erro ${resp.status}`);
  return data as T;
}

async function authedReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getPeticoesToken();
  return req<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } });
}

// ─── action-types / models (públicas, só leitura — cadastro é no standalone) ─

export const fetchActionTypes = () => req<ActionType[]>('/api/action-types').then(r => r.filter(a => a.ativo));

export const fetchModels = (actionTypeId?: string) =>
  req<PetitionModelV2[]>(`/api/models${actionTypeId ? `?action_type_id=${actionTypeId}` : ''}`).then(r => r.filter(m => m.is_active));

// Marcadores {{...}} reais do .docx do modelo — usado pra montar o formulário
// dinâmico de PeticaoEditarPage sem baixar o arquivo no navegador.
export const fetchModelFields = (modelId: string) =>
  req<{ placeholders: string[]; temImagem: boolean }>(`/api/models/${modelId}/fields`);

// ─── petitions (autenticadas — ligadas ao usuário logado) ─────────────────────

export async function fetchPetitions(): Promise<PetitionV2[]> {
  return authedReq<PetitionV2[]>('/api/petitions');
}

export async function fetchPetition(id: string): Promise<PetitionV2 | null> {
  try {
    return await authedReq<PetitionV2>(`/api/petitions/${id}`);
  } catch {
    return null;
  }
}

export async function createPetition(actionTypeId: string, modelId: string): Promise<string> {
  const { id } = await authedReq<{ id: string }>('/api/petitions', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type_id: actionTypeId, model_id: modelId }),
  });
  return id;
}

export async function savePetitionDraft(id: string, formData: Record<string, unknown>, currentStep: number): Promise<void> {
  await authedReq(`/api/petitions/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form_data_json: formData, current_step: currentStep }),
  });
}

export async function duplicatePetition(id: string): Promise<string | null> {
  try {
    const { id: newId } = await authedReq<{ id: string }>(`/api/petitions/${id}/duplicate`, { method: 'POST' });
    return newId;
  } catch {
    return null;
  }
}

export async function markPetitionFiled(id: string): Promise<void> {
  await authedReq(`/api/petitions/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'filed' }),
  });
}

export async function archivePetition(id: string): Promise<void> {
  await authedReq(`/api/petitions/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'archived' }),
  });
}

export async function deletePetition(id: string): Promise<void> {
  await authedReq(`/api/petitions/${id}`, { method: 'DELETE' });
}

// Print pronto (já convertido pra PNG no navegador) a enviar em /generate.
// `field` é "print_slot_<i>" (modelo com print_slots_json, i = índice do
// slot) ou "print_generico_<i>" (fluxo sem slots nomeados).
export interface PrintParaEnviar { field: string; blob: Blob }

export interface GerarResultado { success: boolean; version: number; r2_key: string }
export async function generatePetition(id: string, prints: PrintParaEnviar[] = []): Promise<GerarResultado> {
  if (prints.length === 0) {
    return authedReq<GerarResultado>(`/api/petitions/${id}/generate`, { method: 'POST' });
  }
  const token = await getPeticoesToken();
  const form = new FormData();
  for (const p of prints) form.set(p.field, p.blob, `${p.field}.png`);
  return req<GerarResultado>(`/api/petitions/${id}/generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  });
}

// Gera o .docx com os dados ATUAIS do formulário (mesmo sem estar salvo)
// sem persistir nada, e devolve o base64 pra converter em PDF via a Edge
// Function docx-to-pdf do Supabase — não depende do Worker pra essa parte.
export async function previewPetition(id: string, formData: Record<string, unknown>): Promise<string> {
  const { base64_docx } = await authedReq<{ base64_docx: string }>(`/api/petitions/${id}/preview`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ form_data_json: formData }),
  });
  return base64_docx;
}

export interface PetitionVersion { id: string; version_number: number; generated_r2_key: string; created_at: string }
export async function fetchVersions(id: string): Promise<PetitionVersion[]> {
  return authedReq<PetitionVersion[]>(`/api/petitions/${id}/versions`);
}

// Baixa o .docx (autenticado) e devolve como Blob — a tela decide se
// dispara download direto ou usa o blob de outro jeito.
export async function downloadPetitionFile(r2Key: string): Promise<Blob> {
  const token = await getPeticoesToken();
  const resp = await fetch(`${WORKER_URL}/api/petitions/download?key=${encodeURIComponent(r2Key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error((data as { error?: string })?.error || `Erro ${resp.status} ao baixar`);
  }
  return resp.blob();
}
