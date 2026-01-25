import { Instagram, Facebook, MessageCircle, Send } from 'lucide-react';

interface ChannelIconProps {
  canal?: string;
  size?: 'sm' | 'md';
}

export function ChannelIcon({ canal, size = 'sm' }: ChannelIconProps) {
  const normalizedCanal = canal?.toLowerCase() || '';
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const padding = size === 'sm' ? 'p-0.5' : 'p-1';
  
  if (normalizedCanal.includes('instagram') || normalizedCanal === 'ig') {
    return (
      <div className={`${padding} rounded bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600`}>
        <Instagram className={`${iconSize} text-white`} />
      </div>
    );
  }
  
  if (normalizedCanal.includes('facebook') || normalizedCanal === 'fb' || normalizedCanal.includes('messenger')) {
    return (
      <div className={`${padding} rounded bg-[#1877F2]`}>
        <Facebook className={`${iconSize} text-white`} />
      </div>
    );
  }
  
  if (normalizedCanal.includes('whatsapp') || normalizedCanal === 'wa') {
    return (
      <div className={`${padding} rounded bg-[#25D366]`}>
        <MessageCircle className={`${iconSize} text-white`} />
      </div>
    );
  }
  
  if (normalizedCanal.includes('telegram')) {
    return (
      <div className={`${padding} rounded bg-[#0088cc]`}>
        <Send className={`${iconSize} text-white`} />
      </div>
    );
  }
  
  return null;
}
