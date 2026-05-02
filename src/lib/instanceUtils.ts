/**
 * Utility functions for identifying Z-API instances
 *
 * INSTÂNCIAS CANÔNICAS:
 * - "Bentes Ramos Trafego" → (92) 98588-8190 → leads tipo_origem='trafego'
 * - "Bentes Ramos"         → (92) 91604-348  → leads escritório / whatsapp_direto
 */

export interface InstanceInfo {
  name: string;
  label: string;
  color: 'trafego' | 'escritorio' | 'gray';
}

// Known phone numbers mapped to instances (todos os formatos possíveis)
const KNOWN_INSTANCES: Record<string, InstanceInfo> = {
  // ── Tráfego: "Bentes Ramos Trafego" (92) 98588-8190 ─────────────────────────
  '559285888190':   { name: 'Bentes Ramos Trafego', label: 'Tráfego', color: 'trafego' },
  '5592985888190':  { name: 'Bentes Ramos Trafego', label: 'Tráfego', color: 'trafego' },
  '92985888190':    { name: 'Bentes Ramos Trafego', label: 'Tráfego', color: 'trafego' },
  '9285888190':     { name: 'Bentes Ramos Trafego', label: 'Tráfego', color: 'trafego' },
  '85888190':       { name: 'Bentes Ramos Trafego', label: 'Tráfego', color: 'trafego' },

  // ── Escritório: "Bentes Ramos" (92) 91604-348 ────────────────────────────────
  '559291604348':   { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '5592991604348':  { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '92991604348':    { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '9291604348':     { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '91604348':       { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
};

export function getInstanceFromPhone(phone?: string | null): InstanceInfo | null {
  if (!phone) return null;
  const cleaned = phone.replace(/\D/g, '');
  for (const [pattern, info] of Object.entries(KNOWN_INSTANCES)) {
    if (cleaned === pattern || cleaned.endsWith(pattern)) return info;
  }
  return null;
}

export function getInstanceFromMetadata(metadata?: any): InstanceInfo | null {
  if (!metadata) return null;
  const connectedPhone = metadata?.original?.connectedPhone;
  if (connectedPhone) {
    const fromConnected = getInstanceFromPhone(connectedPhone);
    if (fromConnected) return fromConnected;
  }
  const instancePhone = metadata?.instance_phone ||
                        metadata?.original?.instance_phone ||
                        metadata?.from_instance;
  if (instancePhone) return getInstanceFromPhone(instancePhone);

  const senderPhone = metadata?.original?.phone ||
                      metadata?.original?.sender?.id?.split('@')[0];
  const fromPhone   = metadata?.original?.from?.split('@')[0];
  return getInstanceFromPhone(fromPhone) || getInstanceFromPhone(senderPhone);
}

export function getInstanceFromSubscriber(subscriber?: {
  telefone?: string | null;
  subscriber_id?: string;
  canal?: string;
}): InstanceInfo | null {
  if (!subscriber) return null;
  const fromPhone = getInstanceFromPhone(subscriber.telefone);
  if (fromPhone) return fromPhone;
  if (subscriber.subscriber_id?.startsWith('zapi_')) {
    const phone = subscriber.subscriber_id.replace('zapi_', '');
    return getInstanceFromPhone(phone);
  }
  return null;
}

/**
 * Retorna as classes Tailwind para o badge de instância.
 * Design: pill sólido com ícone, diferenciado por cor de marca.
 */
export function getInstanceBadgeClasses(info: InstanceInfo): string {
  switch (info.color) {
    case 'trafego':
      // Laranja vibrante — identidade "Tráfego pago / Meta Ads"
      return 'bg-orange-500/15 text-orange-700 border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-400/30';
    case 'escritorio':
      // Dourado/marrom — identidade visual do escritório Bentes Ramos
      return 'bg-amber-500/15 text-amber-800 border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400/30';
    default:
      return 'bg-zinc-500/10 text-zinc-500 border-zinc-400/20';
  }
}
