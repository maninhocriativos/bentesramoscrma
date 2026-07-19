-- Slots de print nomeados por modelo de petição — permite que cada modelo
-- defina exatamente quais imagens do .docx são "prova do caso" (substituíveis
-- por um print anexado pelo usuário, uma por uma, identificadas) e mantenha
-- imagens fixas/institucionais (ex.: print de notícia sobre suspensão do
-- banco pelo INSS) intocadas. Nulo/vazio = modelo antigo, mantém o
-- comportamento genérico atual (troca a maior imagem + anexa o resto no fim).
--
-- Formato: array de {"label": "Contrato nº 857098267", "media_target": "media/image1.png"}
ALTER TABLE public.petition_models_v2
  ADD COLUMN IF NOT EXISTS print_slots_json jsonb;
