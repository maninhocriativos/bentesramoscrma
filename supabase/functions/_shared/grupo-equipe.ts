// Envio de mensagens pro grupo interno de WhatsApp da equipe
// ("Bentes Ramos Comercial") — usado pelo isa-scheduler (resumo diário,
// avisos do Gabriel) e pelo zapi-webhook (resposta em tempo real quando a
// Isa é marcada no grupo). Extraído pra cá em 2026-09-11 pra não duplicar
// a mesma lógica (e o mesmo bug) nos dois lugares.
import { getZapiConfig } from './zapi-helper.ts';

// Nome do grupo confirmado pelo usuário em 2026-09-10. A instância
// "Bentes Ramos Trafego" precisa estar adicionada como MEMBRO desse grupo
// pro envio funcionar (senão buscarGroupId() não encontra o grupo na lista
// de chats da instância).
export const GRUPO_EQUIPE_NOME = 'Bentes Ramos Comercial';
export const TRAFEGO_INSTANCE_ID = '3EDDF959BC2B81F86B410203B614D70E';

// sendText() do zapi-helper compartilhado passa o destino por normalizePhone
// (tira tudo que não é dígito) — quebra um ID de grupo, que não é um
// telefone (formato tipo "1203xxxxxxxxx-xxxxxxxxxx@g.us" ou numérico com
// outro padrão). Envio direto aqui, sem mexer no helper usado por todo o
// resto do sistema pra telefone de cliente de verdade.
// `mentioned` (opcional): telefones (formato internacional, só dígitos) a
// marcar — a mensagem precisa conter "@<telefone>" pra cada um pro WhatsApp
// renderizar a marcação (confirmado na doc oficial Z-API, "Mentioning a
// member"). Sem isso, `mentioned` sozinho não marca ninguém.
export async function enviarTextoGrupo(config: { instance_id: string; token: string; client_token?: string }, groupId: string, mensagem: string, mentioned?: string[]): Promise<boolean> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.client_token) headers['Client-Token'] = config.client_token;
    const body: Record<string, unknown> = { phone: groupId, message: mensagem };
    if (mentioned?.length) body.mentioned = mentioned;
    const resp = await fetch(`https://api.z-api.io/instances/${config.instance_id}/token/${config.token}/send-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await resp.json();
    if (resp.ok && !data.error) return true;
    console.error('[Grupo Equipe] Falha ao enviar pro grupo:', data);
    return false;
  } catch (e) {
    console.error('[Grupo Equipe] Erro ao enviar pro grupo:', e);
    return false;
  }
}

export async function buscarGroupId(instanceId: string, token: string, clientToken: string | undefined, nomeGrupo: string): Promise<string | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (clientToken) headers['Client-Token'] = clientToken;
    const resp = await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/chats`, { headers });
    if (!resp.ok) { console.error('[Grupo Equipe] Falha ao listar chats/grupos:', resp.status); return null; }
    const chats = await resp.json();
    // Nome real do grupo no WhatsApp tem espaço duplo — normaliza espaços
    // antes de comparar em vez de casar por igualdade exata (bug já visto).
    const normalizar = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const alvoNome = normalizar(nomeGrupo);
    const alvo = (Array.isArray(chats) ? chats : []).find((c: any) =>
      (c.isGroup || c.type === 'group') && normalizar(c.name || c.chatName || '') === alvoNome
    );
    return alvo?.phone || alvo?.chatId || alvo?.id || null;
  } catch (e) {
    console.error('[Grupo Equipe] Erro ao buscar grupo:', e);
    return null;
  }
}

export async function enviarComoGrupo(supabase: any, mensagem: string, mentioned?: string[]): Promise<{ enviado: boolean; motivo: string }> {
  if (!GRUPO_EQUIPE_NOME) return { enviado: false, motivo: 'grupo_nao_configurado' };
  const config = await getZapiConfig(supabase, TRAFEGO_INSTANCE_ID);
  if (!config) return { enviado: false, motivo: 'instancia_nao_encontrada' };
  const groupId = await buscarGroupId(config.instance_id, config.token, config.client_token, GRUPO_EQUIPE_NOME);
  if (!groupId) return { enviado: false, motivo: 'grupo_nao_encontrado' };
  const enviado = await enviarTextoGrupo(config, groupId, mensagem, mentioned);
  return { enviado, motivo: enviado ? 'ok' : 'falha_envio' };
}
