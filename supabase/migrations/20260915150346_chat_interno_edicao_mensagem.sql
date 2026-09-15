-- Permite editar mensagem já enviada no Chat Interno (pedido do usuário:
-- corrigir mensagem errada). Só o próprio remetente pode editar a própria
-- mensagem (mesma regra de quem pode inserir).
alter table chat_mensagens add column edited_at timestamptz null;

create policy chat_edicao on chat_mensagens
  for update
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);
