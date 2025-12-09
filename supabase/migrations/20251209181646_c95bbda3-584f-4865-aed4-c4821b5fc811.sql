-- =============================================
-- MÓDULO FINANCEIRO
-- =============================================

-- Tabela de Honorários/Contratos de Serviço
CREATE TABLE public.honorarios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL DEFAULT 'Fixo', -- Fixo, Por Êxito, Misto
  valor_total DECIMAL(12,2) NOT NULL DEFAULT 0,
  valor_entrada DECIMAL(12,2) DEFAULT 0,
  percentual_exito DECIMAL(5,2) DEFAULT 0,
  forma_pagamento TEXT DEFAULT 'À Vista', -- À Vista, Parcelado
  num_parcelas INTEGER DEFAULT 1,
  data_contrato DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'Ativo', -- Ativo, Cancelado, Concluído
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Parcelas/Contas a Receber
CREATE TABLE public.parcelas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  honorario_id UUID REFERENCES public.honorarios(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'Pendente', -- Pendente, Pago, Atrasado, Cancelado
  forma_pagamento TEXT, -- PIX, Boleto, Cartão, Dinheiro, Transferência
  comprovante_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Despesas Processuais
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- Custas, Honorários Periciais, Diligências, Cópias, Outros
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  data_despesa DATE DEFAULT CURRENT_DATE,
  data_pagamento DATE,
  status TEXT DEFAULT 'Pendente', -- Pendente, Pago, Reembolsado
  responsavel_pagamento TEXT DEFAULT 'Escritório', -- Escritório, Cliente
  comprovante_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- MÓDULO DE DOCUMENTOS
-- =============================================

-- Tabela de Documentos
CREATE TABLE public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL, -- Petição, Contrato, Procuração, Documento Pessoal, Comprovante, Outros
  descricao TEXT,
  arquivo_url TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  arquivo_tamanho INTEGER,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- MÓDULO DE TAREFAS E TIMESHEET
-- =============================================

-- Tabela de Tarefas
CREATE TABLE public.tarefas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID,
  prioridade TEXT DEFAULT 'Media', -- Baixa, Media, Alta, Urgente
  status TEXT DEFAULT 'Pendente', -- Pendente, Em Andamento, Concluída, Cancelada
  data_limite DATE,
  data_conclusao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Timesheet (Controle de Horas)
CREATE TABLE public.timesheet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  usuario_id UUID NOT NULL,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.leads_juridicos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  data_atividade DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_inicio TIME,
  hora_fim TIME,
  duracao_minutos INTEGER NOT NULL DEFAULT 0,
  tipo_atividade TEXT, -- Reunião, Elaboração de Peça, Audiência, Pesquisa, Atendimento
  faturavel BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- MÓDULO DE COMUNICAÇÃO
-- =============================================

-- Tabela de Interações/Histórico de Comunicação
CREATE TABLE public.interacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id UUID REFERENCES public.leads_juridicos(id) ON DELETE CASCADE,
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL, -- Ligação, Email, WhatsApp, Reunião, Atendimento Presencial
  direcao TEXT DEFAULT 'Saída', -- Entrada, Saída
  resumo TEXT NOT NULL,
  detalhes TEXT,
  responsavel_id UUID,
  data_interacao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de Notificações de Prazos
CREATE TABLE public.notificacoes_prazos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  compromisso_id UUID REFERENCES public.compromissos(id) ON DELETE CASCADE,
  tarefa_id UUID REFERENCES public.tarefas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, -- Prazo Judicial, Audiência, Reunião, Tarefa
  titulo TEXT NOT NULL,
  data_prazo TIMESTAMP WITH TIME ZONE NOT NULL,
  dias_antecedencia INTEGER DEFAULT 3,
  notificado BOOLEAN DEFAULT false,
  notificado_em TIMESTAMP WITH TIME ZONE,
  canal TEXT DEFAULT 'Email', -- Email, WhatsApp, Ambos
  destinatario_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.honorarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timesheet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes_prazos ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES - HONORÁRIOS
-- =============================================

CREATE POLICY "View honorarios" ON public.honorarios
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR 
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Insert honorarios" ON public.honorarios
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Update honorarios" ON public.honorarios
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Delete honorarios" ON public.honorarios
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - PARCELAS
-- =============================================

CREATE POLICY "View parcelas" ON public.parcelas
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR 
  has_role(auth.uid(), 'Advogado') OR
  has_role(auth.uid(), 'Secretaria')
);

CREATE POLICY "Insert parcelas" ON public.parcelas
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Update parcelas" ON public.parcelas
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Secretaria')
);

CREATE POLICY "Delete parcelas" ON public.parcelas
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - DESPESAS
-- =============================================

CREATE POLICY "View despesas" ON public.despesas
FOR SELECT USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR 
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Insert despesas" ON public.despesas
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Update despesas" ON public.despesas
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Delete despesas" ON public.despesas
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - DOCUMENTOS
-- =============================================

CREATE POLICY "View documentos" ON public.documentos
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert documentos" ON public.documentos
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Update documentos" ON public.documentos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Delete documentos" ON public.documentos
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - TAREFAS
-- =============================================

CREATE POLICY "View tarefas" ON public.tarefas
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert tarefas" ON public.tarefas
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Update tarefas" ON public.tarefas
FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Delete tarefas" ON public.tarefas
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - TIMESHEET
-- =============================================

CREATE POLICY "View own timesheet" ON public.timesheet
FOR SELECT USING (
  usuario_id = auth.uid() OR
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Insert own timesheet" ON public.timesheet
FOR INSERT WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "Update own timesheet" ON public.timesheet
FOR UPDATE USING (
  usuario_id = auth.uid() OR
  has_role(auth.uid(), 'Administrador')
);

CREATE POLICY "Delete timesheet" ON public.timesheet
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - INTERAÇÕES
-- =============================================

CREATE POLICY "View interacoes" ON public.interacoes
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert interacoes" ON public.interacoes
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Update interacoes" ON public.interacoes
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Delete interacoes" ON public.interacoes
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- RLS POLICIES - NOTIFICAÇÕES DE PRAZOS
-- =============================================

CREATE POLICY "View notificacoes" ON public.notificacoes_prazos
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Insert notificacoes" ON public.notificacoes_prazos
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente') OR
  has_role(auth.uid(), 'Advogado')
);

CREATE POLICY "Update notificacoes" ON public.notificacoes_prazos
FOR UPDATE USING (
  has_role(auth.uid(), 'Administrador') OR 
  has_role(auth.uid(), 'Gerente')
);

CREATE POLICY "Delete notificacoes" ON public.notificacoes_prazos
FOR DELETE USING (has_role(auth.uid(), 'Administrador'));

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================

CREATE TRIGGER update_honorarios_updated_at
  BEFORE UPDATE ON public.honorarios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parcelas_updated_at
  BEFORE UPDATE ON public.parcelas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_despesas_updated_at
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_documentos_updated_at
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tarefas_updated_at
  BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_timesheet_updated_at
  BEFORE UPDATE ON public.timesheet
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE BUCKET FOR DOCUMENTS
-- =============================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('documentos', 'documentos', false);

-- Storage policies
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can delete documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documentos' AND has_role(auth.uid(), 'Administrador'));

CREATE POLICY "Users can update their own uploads"
ON storage.objects FOR UPDATE
USING (bucket_id = 'documentos' AND auth.role() = 'authenticated');