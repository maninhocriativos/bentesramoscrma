// Cliente de dados do módulo de Petições v2 — backend real (Cloudflare
// Worker + D1 + R2, ver D:\crm-bentes_ramos\peticoes-cloudflare). Rotas de
// action-types/models são públicas (mesmo backend que a página standalone
// de cadastro de modelos usa — peticoes-modelos-admin.bentesramos.workers.dev);
// rotas de petitions exigem o token de serviço (peticoesAuthBridge).
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

// ─── action-types / models (públicas, mesmo backend da página standalone) ────

export const fetchActionTypes = () => req<ActionType[]>('/api/action-types').then(r => r.filter(a => a.ativo));
export const fetchAllActionTypes = () => req<ActionType[]>('/api/action-types');

export const fetchModels = (actionTypeId?: string) =>
  req<PetitionModelV2[]>(`/api/models${actionTypeId ? `?action_type_id=${actionTypeId}` : ''}`).then(r => r.filter(m => m.is_active));
export const fetchAllModels = () => req<PetitionModelV2[]>('/api/models');

export const createActionType = (nome: string, descricao: string) =>
  req<ActionType>('/api/action-types', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, descricao }),
  });

export interface CreateModelInput {
  file: File;
  actionTypeId: string;
  nome: string;
  descricao: string;
  tags: string[];
  printSlots: PrintSlot[] | null;
  isActive: boolean;
  isDefault: boolean;
}
export async function createModel(input: CreateModelInput): Promise<PetitionModelV2> {
  const form = new FormData();
  form.set('file', input.file);
  form.set('action_type_id', input.actionTypeId);
  form.set('nome', input.nome);
  form.set('descricao', input.descricao);
  form.set('tags', JSON.stringify(input.tags));
  form.set('print_slots_json', input.printSlots ? JSON.stringify(input.printSlots) : '');
  form.set('is_active', String(input.isActive));
  form.set('is_default', String(input.isDefault));
  return req<PetitionModelV2>('/api/models', { method: 'POST', body: form });
}

export interface UpdateModelInput {
  actionTypeId?: string; nome?: string; descricao?: string; tags?: string[];
  isActive?: boolean; isDefault?: boolean;
}
export const updateModel = (id: string, updates: UpdateModelInput) =>
  req<PetitionModelV2>(`/api/models/${id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action_type_id: updates.actionTypeId, nome: updates.nome, descricao: updates.descricao,
      tags: updates.tags, is_active: updates.isActive, is_default: updates.isDefault,
    }),
  });

export const toggleModelActive = async (id: string) => {
  const models = await fetchAllModels();
  const m = models.find(x => x.id === id);
  if (!m) return;
  await updateModel(id, { isActive: !m.is_active });
};

export const deleteModel = (id: string) => req<{ success: boolean }>(`/api/models/${id}`, { method: 'DELETE' });

// Marcadores {{...}} reais do .docx do modelo — usado pra montar o formulário
// dinâmico de PeticaoEditarPageV2 sem baixar o arquivo no navegador.
export const fetchModelFields = (modelId: string) =>
  req<{ placeholders: string[] }>(`/api/models/${modelId}/fields`).then(r => r.placeholders);

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

export interface GerarResultado { success: boolean; version: number; r2_key: string }
export async function generatePetition(id: string): Promise<GerarResultado> {
  return authedReq<GerarResultado>(`/api/petitions/${id}/generate`, { method: 'POST' });
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
