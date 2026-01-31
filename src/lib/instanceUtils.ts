/**
 * Utility functions for identifying Z-API instances
 */

export interface InstanceInfo {
  name: string;
  label: string;
  color: 'orange' | 'blue' | 'gray';
}

// Known phone numbers mapped to instances
const KNOWN_INSTANCES: Record<string, InstanceInfo> = {
  // Tráfego - Bentes Ramos-2 (92 98588-8190)
  '559285888190': { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'orange' },
  '5592985888190': { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'orange' },
  '92985888190': { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'orange' },
  '9285888190': { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'orange' },
  '85888190': { name: 'Bentes Ramos-2', label: 'Tráfego', color: 'orange' },
  
  // Bentes Ramos Antigo (92 99160-4348)
  '559291604348': { name: 'Bentes Ramos', label: 'Bentes Ramos antigo', color: 'blue' },
  '5592991604348': { name: 'Bentes Ramos', label: 'Bentes Ramos antigo', color: 'blue' },
  '92991604348': { name: 'Bentes Ramos', label: 'Bentes Ramos antigo', color: 'blue' },
  '9291604348': { name: 'Bentes Ramos', label: 'Bentes Ramos antigo', color: 'blue' },
  '91604348': { name: 'Bentes Ramos', label: 'Bentes Ramos antigo', color: 'blue' },
};

/**
 * Get instance info from a phone number (from metadata or subscriber)
 */
export function getInstanceFromPhone(phone?: string | null): InstanceInfo | null {
  if (!phone) return null;
  
  const cleaned = phone.replace(/\D/g, '');
  
  // Try to match with known instances
  for (const [pattern, info] of Object.entries(KNOWN_INSTANCES)) {
    if (cleaned === pattern || cleaned.endsWith(pattern)) {
      return info;
    }
  }
  
  return null;
}

/**
 * Get instance info from message metadata (Z-API)
 */
export function getInstanceFromMetadata(metadata?: any): InstanceInfo | null {
  if (!metadata) return null;
  
  // Z-API (ReceivedCallback) costuma trazer o número conectado (o nosso número)
  // como `original.connectedPhone`. Esse é o sinal mais confiável para definir
  // qual instância recebeu a mensagem.
  const connectedPhone = metadata?.original?.connectedPhone;
  if (connectedPhone) {
    const fromConnected = getInstanceFromPhone(connectedPhone);
    if (fromConnected) return fromConnected;
  }

  // Z-API includes instance info in metadata
  const instancePhone = metadata?.instance_phone || 
                        metadata?.original?.instance_phone ||
                        metadata?.from_instance;
  
  if (instancePhone) {
    return getInstanceFromPhone(instancePhone);
  }
  
  // Try to detect from sender/receiver phone patterns
  const senderPhone = metadata?.original?.phone || 
                      metadata?.original?.sender?.id?.split('@')[0];
  
  // If message is outgoing, the instance phone would be in 'from'
  const fromPhone = metadata?.original?.from?.split('@')[0];
  
  return getInstanceFromPhone(fromPhone) || getInstanceFromPhone(senderPhone);
}

/**
 * Detect instance from subscriber data
 */
export function getInstanceFromSubscriber(subscriber?: { 
  telefone?: string | null;
  subscriber_id?: string;
  canal?: string;
}): InstanceInfo | null {
  if (!subscriber) return null;
  
  // Try phone first
  const fromPhone = getInstanceFromPhone(subscriber.telefone);
  if (fromPhone) return fromPhone;
  
  // Try to extract phone from subscriber_id (zapi_5592...)
  if (subscriber.subscriber_id?.startsWith('zapi_')) {
    const phone = subscriber.subscriber_id.replace('zapi_', '');
    return getInstanceFromPhone(phone);
  }
  
  return null;
}

/**
 * Get instance badge color classes
 */
export function getInstanceBadgeClasses(info: InstanceInfo): string {
  switch (info.color) {
    case 'orange':
      return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
    case 'blue':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
}
