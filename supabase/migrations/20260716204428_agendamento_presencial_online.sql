-- Agendamento presencial/online (modal "Agendar Consulta Jurídica" do chat) +
-- lembretes automáticos 24h/5h/2h + verificação de não comparecimento.
-- Colunas novas, todas nullable — nada muda para compromissos já existentes.

ALTER TABLE public.compromissos
  ADD COLUMN IF NOT EXISTS modalidade text CHECK (modalidade IN ('online', 'presencial')),
  ADD COLUMN IF NOT EXISTS local_reuniao text,
  ADD COLUMN IF NOT EXISTS nome_contato text,
  ADD COLUMN IF NOT EXISTS telefone_contato text,
  ADD COLUMN IF NOT EXISTS subscriber_id text,
  ADD COLUMN IF NOT EXISTS zapi_instance_id text,
  ADD COLUMN IF NOT EXISTS lembrete_24h_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS lembrete_5h_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS lembrete_2h_enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS verificacao_comparecimento_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_compromissos_modalidade
  ON public.compromissos(modalidade) WHERE modalidade IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_compromissos_subscriber_id
  ON public.compromissos(subscriber_id) WHERE subscriber_id IS NOT NULL;

-- Garantia atômica contra dois agendamentos (presencial OU online) no mesmo
-- horário — a checagem de disponibilidade no código é só otimização de UX,
-- esse índice é a proteção real contra race condition.
CREATE UNIQUE INDEX IF NOT EXISTS uq_compromissos_slot_consulta
  ON public.compromissos (data_inicio)
  WHERE modalidade IS NOT NULL AND confirmacao_status <> 'cancelado';
