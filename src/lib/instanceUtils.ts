/**
 * Utility functions for identifying Z-API instances
 *
 * INSTÂNCIAS CANÔNICAS (REGRA IMUTÁVEL):
 * - "Bentes Ramos Trafego" → (92) 98588-8190  [5592985888190] → leads tipo_origem='trafego'
 * - "Bentes Ramos"         → (92) 99160-4348  [5592991604348] → leads escritório / whatsapp_direto
 *
 * Clientes de tráfego → SOMENTE pelo número de tráfego
 * Clientes do escritório → SOMENTE pelo número do escritório
 * Estas instâncias NUNCA se misturam.
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

  // ── Escritório: "Bentes Ramos" (92) 99160-4348 ──────────────────────────────
  '5592991604348':  { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '92991604348':    { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '991604348':      { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' },
  '91604348':       { name: 'Bentes Ramos', label: 'Bentes Ramos', color: 'escritorio' }, // suffix fallback
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
      // Vermelho — tráfego pago / Meta Ads → instância "Bentes Ramos Trafego" (98588-8190)
      return 'bg-red-500/15 text-red-700 border-red-400/40 dark:bg-red-500/20 dark:text-red-300 dark:border-red-400/30';
    case 'escritorio':
      // Azul — clientes do escritório → instância "Bentes Ramos" (99160-4348)
      return 'bg-blue-500/15 text-blue-700 border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30';
    default:
      return 'bg-zinc-500/10 text-zinc-500 border-zinc-400/20';
  }
}
