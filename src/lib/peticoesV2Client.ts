// Cliente de dados do módulo de Petições v2 (backend novo, Cloudflare Worker
// + D1 + R2 — ver plano em D:\crm-bentes_ramos\peticoes-cloudflare).
//
// Ainda em MOCK: as rotas reais do Worker (/api/action-types, /api/models,
// /api/petitions...) não existem ainda, então este arquivo simula as mesmas
// respostas com dados de exemplo e um pequeno delay artificial, no formato
// EXATO que a API real vai devolver — trocar de mock pra real depois é só
// substituir o corpo de cada função por um fetch(), sem tocar nas telas que
// os consomem.

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

const DELAY_MS = 250; // simula latência de rede — remover quando plugar na API real
const delay = () => new Promise(res => setTimeout(res, DELAY_MS));

// ─── Dados de exemplo ────────────────────────────────────────────────────────

const MOCK_ACTION_TYPES: ActionType[] = [
  { id: 'at-1', slug: 'emprestimo_nao_reconhecido', nome: 'Empréstimo Não Reconhecido', descricao: 'Desconto em folha não autorizado pelo cliente', icone: 'AlertTriangle', cor: 'red', ativo: true },
  { id: 'at-2', slug: 'vendas_casadas', nome: 'Venda Casada', descricao: 'Seguro ou produto vinculado sem consentimento', icone: 'ShoppingCart', cor: 'orange', ativo: true },
  { id: 'at-3', slug: 'rmc_rcc', nome: 'RMC / RCC', descricao: 'Reserva de margem consignável não autorizada', icone: 'CreditCard', cor: 'violet', ativo: true },
  { id: 'at-4', slug: 'cancelamento_voo', nome: 'Cancelamento de Voo', descricao: 'Danos morais por cancelamento/atraso', icone: 'Plane', cor: 'sky', ativo: true },
  { id: 'at-5', slug: 'tarifa_bancaria', nome: 'Tarifa Bancária Indevida', descricao: 'Repetição de indébito por cobrança indevida', icone: 'Ban', cor: 'rose', ativo: true },
];

const MOCK_MODELS: PetitionModelV2[] = [
  { id: 'm-1', action_type_id: 'at-1', nome: 'Servidor Público – Matrícula A', slug: 'servidor-publico-a', descricao: 'Desconto em folha não autorizado (servidor municipal)', tags: ['Servidor Público', 'Matrícula'], template_r2_key: null, is_active: true, is_default: true, print_slots_json: null },
  { id: 'm-2', action_type_id: 'at-1', nome: 'Aposentado INSS', slug: 'aposentado-inss', descricao: 'Empréstimo consignado fraudulento (idoso)', tags: ['INSS', 'Idoso'], template_r2_key: null, is_active: true, is_default: false, print_slots_json: null },
  { id: 'm-3', action_type_id: 'at-2', nome: 'Venda Casada – INSS (Idoso)', slug: 'venda-casada-inss', descricao: 'Seguro vinculado a empréstimo consignado', tags: ['INSS', 'Idoso'], template_r2_key: null, is_active: true, is_default: true, print_slots_json: null },
  { id: 'm-4', action_type_id: 'at-3', nome: 'RMC – Idoso INSS', slug: 'rmc-idoso', descricao: 'Reserva de margem não autorizada', tags: ['INSS', 'Idoso'], template_r2_key: null, is_active: true, is_default: true, print_slots_json: null },
  { id: 'm-5', action_type_id: 'at-4', nome: 'Cancelamento de Voo – Geral', slug: 'voo-geral', descricao: 'Ação de reparação por danos morais', tags: ['Aéreo', 'Juizado Especial'], template_r2_key: null, is_active: true, is_default: true, print_slots_json: null },
];

const MOCK_PETITIONS: PetitionV2[] = [
  { id: 'p-1', action_type_id: 'at-1', model_id: 'm-1', status: 'draft', form_data_json: { nome_completo: 'Maria da Silva Souza' }, current_step: 2, generated_r2_key: null, created_at: '2026-08-25T13:00:00Z', updated_at: '2026-08-26T09:00:00Z' },
  { id: 'p-2', action_type_id: 'at-4', model_id: 'm-5', status: 'review', form_data_json: { nome_completo: 'João Batista Nunes' }, current_step: 5, generated_r2_key: null, created_at: '2026-08-24T10:00:00Z', updated_at: '2026-08-25T15:30:00Z' },
  { id: 'p-3', action_type_id: 'at-2', model_id: 'm-3', status: 'generated', form_data_json: { nome_completo: 'Antônia Ferreira Lima' }, current_step: 6, generated_r2_key: 'geradas/p-3-v1.docx', created_at: '2026-08-20T08:00:00Z', updated_at: '2026-08-22T11:20:00Z' },
  { id: 'p-4', action_type_id: 'at-3', model_id: 'm-4', status: 'filed', form_data_json: { nome_completo: 'Raimundo Costa Neto' }, current_step: 6, generated_r2_key: 'geradas/p-4-v1.docx', created_at: '2026-08-10T08:00:00Z', updated_at: '2026-08-11T09:00:00Z' },
];

function attachJoins(p: PetitionV2): PetitionV2 {
  return {
    ...p,
    action_types: MOCK_ACTION_TYPES.find(a => a.id === p.action_type_id),
    petition_models: MOCK_MODELS.find(m => m.id === p.model_id),
  };
}

// ─── API ──────────────────────────────────────────────────────────────────────

export async function fetchActionTypes(): Promise<ActionType[]> {
  await delay();
  return MOCK_ACTION_TYPES.filter(a => a.ativo);
}

export async function fetchModels(actionTypeId?: string): Promise<PetitionModelV2[]> {
  await delay();
  return MOCK_MODELS.filter(m => m.is_active && (!actionTypeId || m.action_type_id === actionTypeId));
}

// ─── Admin (tela de cadastro de modelos) ──────────────────────────────────────
// Inclui inativos — a lista de admin precisa mostrar tudo, não só o que
// aparece pro advogado no catálogo.

export async function fetchAllActionTypes(): Promise<ActionType[]> {
  await delay();
  return [...MOCK_ACTION_TYPES];
}

export async function fetchAllModels(): Promise<PetitionModelV2[]> {
  await delay();
  return [...MOCK_MODELS];
}

function slugify(nome: string): string {
  return nome
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export async function createActionType(nome: string, descricao: string): Promise<ActionType> {
  await delay();
  const at: ActionType = {
    id: `at-${Date.now()}`, slug: slugify(nome), nome, descricao: descricao || null,
    icone: 'FileText', cor: 'slate', ativo: true,
  };
  MOCK_ACTION_TYPES.push(at);
  return at;
}

export interface CreateModelInput {
  actionTypeId: string;
  nome: string;
  descricao: string;
  tags: string[];
  templateFileName: string; // no futuro: o R2 key real após o upload
  printSlots: PrintSlot[] | null;
  isActive: boolean;
  isDefault: boolean;
}

// Cria o modelo já dentro da categoria escolhida — some da tela de admin
// e aparece imediatamente no catálogo (PeticoesPageV2), porque as duas telas
// leem o mesmo MOCK_MODELS. No backend real isso vira POST /api/models,
// multipart com o .docx, e o Worker salva no R2 + insere no D1.
export async function createModel(input: CreateModelInput): Promise<PetitionModelV2> {
  await delay();
  if (input.isDefault) {
    for (const m of MOCK_MODELS) if (m.action_type_id === input.actionTypeId) m.is_default = false;
  }
  const model: PetitionModelV2 = {
    id: `m-${Date.now()}`,
    action_type_id: input.actionTypeId,
    nome: input.nome,
    slug: slugify(input.nome),
    descricao: input.descricao || null,
    tags: input.tags,
    template_r2_key: input.templateFileName,
    is_active: input.isActive,
    is_default: input.isDefault,
    print_slots_json: input.printSlots,
  };
  MOCK_MODELS.push(model);
  return model;
}

export async function updateModel(id: string, updates: Partial<CreateModelInput>): Promise<void> {
  await delay();
  const m = MOCK_MODELS.find(x => x.id === id);
  if (!m) return;
  if (updates.isDefault) {
    for (const other of MOCK_MODELS) if (other.action_type_id === m.action_type_id) other.is_default = false;
  }
  if (updates.actionTypeId !== undefined) m.action_type_id = updates.actionTypeId;
  if (updates.nome !== undefined) { m.nome = updates.nome; m.slug = slugify(updates.nome); }
  if (updates.descricao !== undefined) m.descricao = updates.descricao || null;
  if (updates.tags !== undefined) m.tags = updates.tags;
  if (updates.isActive !== undefined) m.is_active = updates.isActive;
  if (updates.isDefault !== undefined) m.is_default = updates.isDefault;
}

export async function toggleModelActive(id: string): Promise<void> {
  await delay();
  const m = MOCK_MODELS.find(x => x.id === id);
  if (m) m.is_active = !m.is_active;
}

export async function deleteModel(id: string): Promise<void> {
  await delay();
  const idx = MOCK_MODELS.findIndex(x => x.id === id);
  if (idx >= 0) MOCK_MODELS.splice(idx, 1);
}

export async function fetchPetitions(): Promise<PetitionV2[]> {
  await delay();
  return MOCK_PETITIONS.map(attachJoins).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function fetchPetition(id: string): Promise<PetitionV2 | null> {
  await delay();
  const p = MOCK_PETITIONS.find(x => x.id === id);
  return p ? attachJoins(p) : null;
}

export async function createPetition(actionTypeId: string, modelId: string): Promise<string> {
  await delay();
  const id = `p-${Date.now()}`;
  MOCK_PETITIONS.unshift({
    id, action_type_id: actionTypeId, model_id: modelId, status: 'draft',
    form_data_json: {}, current_step: 1, generated_r2_key: null,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  return id;
}

export async function duplicatePetition(id: string): Promise<string | null> {
  const original = MOCK_PETITIONS.find(p => p.id === id);
  if (!original) return null;
  return createPetition(original.action_type_id!, original.model_id!);
}

export async function archivePetition(id: string): Promise<void> {
  await delay();
  const p = MOCK_PETITIONS.find(x => x.id === id);
  if (p) p.status = 'archived';
}

export async function deletePetition(id: string): Promise<void> {
  await delay();
  const idx = MOCK_PETITIONS.findIndex(x => x.id === id);
  if (idx >= 0) MOCK_PETITIONS.splice(idx, 1);
}
