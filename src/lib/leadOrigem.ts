// Extraído de useZapsignContratos.ts para reuso por useContratosFechados.ts —
// evita reescrever a mesma regra de classificação tráfego/escritório pela 2ª vez.

export type TipoOrigemLead = 'trafego' | 'escritorio' | 'indefinido';

function normalizeText(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export function classifyOrigemLead(lead: any): TipoOrigemLead {
  if (!lead) return 'indefinido';

  // A instância de WhatsApp por onde o lead foi atendido é a fonte da
  // verdade: linha de tráfego → tráfego, linha do escritório → escritório,
  // sempre, mesmo que o campo `origem` (texto livre, editável, pode ficar
  // desatualizado) diga outra coisa. Confirmado com dados reais: leads
  // atendidos pela linha do escritório mas com origem="Tráfego Pago" (e
  // vice-versa) inflavam a contagem errada no dashboard.
  if (lead.linha_whatsapp === 'trafego_isa') return 'trafego';
  if (lead.linha_whatsapp === 'bentes_ramos_antigo') return 'escritorio';

  // Sem instância definida (linha_whatsapp = 'indefinido' ou ausente):
  // cai para os sinais textuais como fallback.
  const origemText = normalizeText([
    lead.origem,
    lead.fonte_trafego,
    lead.canal_origem,
    lead.empresa_tag,
  ].filter(Boolean).join(' '));

  if (
    lead.tipo_origem === 'trafego' ||
    Boolean(lead.fonte_trafego) ||
    Boolean(lead.facebook_lead_id) ||
    origemText.includes('trafego') ||
    origemText.includes('meta') ||
    origemText.includes('facebook') ||
    origemText.includes('instagram') ||
    origemText.includes('google') ||
    origemText.includes('anuncio') ||
    origemText.includes('ads')
  ) return 'trafego';
  // Qualquer lead vinculado que NÃO é de tráfego é cliente do escritório
  // (direto/orgânico).
  return 'escritorio';
}
