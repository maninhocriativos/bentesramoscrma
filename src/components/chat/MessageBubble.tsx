import { CheckCheck, Play, Download, MapPin, ExternalLink, X } from 'lucide-react';
import { formatMessageTime, detectMediaType, extractLocationData } from '@/lib/chatUtils';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogClose } from '@/components/ui/dialog';

interface MessageBubbleProps {
  message: ChatMessage;
  themeClasses: {
    messageSent: string;
    messageReceived: string;
    messageSentText: string;
    messageReceivedText: string;
    messageTime: string;
  };
}

// Extrair URL de áudio de diferentes fontes
function extractAudioUrl(message: ChatMessage): string | null {
  // 1. Tentar extrair de metadata.original (Z-API payload)
  const metadata = message.metadata as any;
  if (metadata?.original?.audio?.audioUrl) {
    return metadata.original.audio.audioUrl;
  }
  if (metadata?.original?.audio?.link) {
    return metadata.original.audio.link;
  }
  
  // 2. Tentar media_url diretamente no metadata
  if (metadata?.media_url) {
    return metadata.media_url;
  }
  
  // 3. Se conteúdo é uma URL de áudio
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+\.(ogg|mp3|wav|m4a|opus|aac|webm)/i) ||
      cleanUrl.includes('whatsapp') || 
      cleanUrl.includes('z-api') ||
      cleanUrl.includes('filesusr') ||
      cleanUrl.includes('mmg.whatsapp')) {
    return cleanUrl;
  }
  
  return null;
}

// Extrair URL de imagem
function extractImageUrl(message: ChatMessage): string | null {
  const metadata = message.metadata as any;
  if (metadata?.original?.image?.imageUrl) {
    return metadata.original.image.imageUrl;
  }
  if (metadata?.original?.image?.link) {
    return metadata.original.image.link;
  }
  if (metadata?.media_url) {
    return metadata.media_url;
  }
  
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i)) {
    return cleanUrl;
  }
  
  return null;
}

// Extrair URL de sticker
function extractStickerUrl(message: ChatMessage): string | null {
  const metadata = message.metadata as any;
  if (metadata?.original?.sticker?.stickerUrl) {
    return metadata.original.sticker.stickerUrl;
  }
  if (metadata?.original?.sticker?.link) {
    return metadata.original.sticker.link;
  }
  if (metadata?.original?.sticker?.url) {
    return metadata.original.sticker.url;
  }
  if (metadata?.original?.sticker?.imageUrl) {
    return metadata.original.sticker.imageUrl;
  }
  if (metadata?.media_url) {
    return metadata.media_url;
  }
  
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+/i)) {
    return cleanUrl;
  }
  
  return null;
}

export function MessageBubble({ message, themeClasses }: MessageBubbleProps) {
  const isSent = message.direcao === 'saida';
  const content = message.conteudo || '';
  const mediaType = detectMediaType(content, message.tipo);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [audioError, setAudioError] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const renderContent = () => {
    switch (mediaType) {
      case 'audio': {
        const audioUrl = extractAudioUrl(message);
        
        if (!audioUrl || audioError) {
          return (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <span>🎤</span>
              <span>Áudio recebido</span>
              {audioUrl && (
                <a 
                  href={audioUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Download className="h-3 w-3" />
                  Baixar
                </a>
              )}
            </div>
          );
        }
        
        return (
          <div className="flex items-center gap-2">
            <audio 
              ref={audioRef}
              controls 
              className="max-w-[220px] h-10" 
              preload="metadata"
              onError={() => setAudioError(true)}
            >
              <source src={audioUrl} type="audio/ogg" />
              <source src={audioUrl} type="audio/mpeg" />
              <source src={audioUrl} type="audio/mp4" />
              <source src={audioUrl} type="audio/webm" />
              Seu navegador não suporta áudio.
            </audio>
          </div>
        );
      }
      
      case 'image': {
        const imageUrl = extractImageUrl(message);
        const displayUrl = imageUrl || content.replace(/^\[|\]$/g, '');
        
        return (
          <>
            <img 
              src={displayUrl} 
              alt="Imagem" 
              className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setPreviewImage(displayUrl)}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <Dialog open={previewImage === displayUrl} onOpenChange={(open) => !open && setPreviewImage(null)}>
              <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 bg-black/95 border-none overflow-hidden">
                <button
                  onClick={() => setPreviewImage(null)}
                  className="absolute top-3 right-3 z-50 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
                <img 
                  src={displayUrl} 
                  alt="Imagem ampliada" 
                  className="max-w-full max-h-[85vh] object-contain mx-auto"
                />
              </DialogContent>
            </Dialog>
          </>
        );
      }
      
      case 'video': {
        const videoUrl = content.replace(/^\[|\]$/g, '');
        return (
          <video controls className="max-w-[280px] rounded-lg" preload="metadata">
            <source src={videoUrl} />
          </video>
        );
      }
      
      case 'document': {
        const docUrl = content.replace(/^\[|\]$/g, '');
        return (
          <a 
            href={docUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-500 hover:underline"
          >
            📄 {content.split('/').pop() || 'Documento'}
          </a>
        );
      }
      
      case 'sticker': {
        const stickerUrl = extractStickerUrl(message);
        
        if (!stickerUrl) {
          return (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <span>🎭</span>
              <span>Sticker</span>
            </div>
          );
        }
        
        return (
          <img 
            src={stickerUrl} 
            alt="Sticker" 
            className="max-w-[120px] max-h-[120px] rounded cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(stickerUrl, '_blank')}
            onError={(e) => {
              (e.target as HTMLImageElement).src = '';
              (e.target as HTMLImageElement).alt = '🎭 Sticker';
            }}
          />
        );
      }
      
      case 'location': {
        const locationData = extractLocationData(content, message.metadata);
        
        if (!locationData) {
          return (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <MapPin className="h-4 w-4" />
              <span>Localização</span>
            </div>
          );
        }
        
        const hasCoords = locationData.lat && locationData.lng;
        const mapPreviewUrl = hasCoords 
          ? `https://maps.googleapis.com/maps/api/staticmap?center=${locationData.lat},${locationData.lng}&zoom=15&size=280x150&markers=color:red%7C${locationData.lat},${locationData.lng}&key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8`
          : null;
        
        return (
          <div 
            className="rounded-lg overflow-hidden cursor-pointer hover:opacity-95 transition-opacity max-w-[280px]"
            onClick={() => locationData.url && window.open(locationData.url, '_blank')}
          >
            {/* Map Preview */}
            <div className="relative bg-gradient-to-br from-emerald-500/20 to-teal-600/20 h-[120px] flex items-center justify-center">
              {mapPreviewUrl ? (
                <img 
                  src={mapPreviewUrl} 
                  alt="Mapa" 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-emerald-600">
                  <MapPin className="h-10 w-10" />
                  <span className="text-xs opacity-70">Clique para abrir</span>
                </div>
              )}
              {/* Overlay com pin */}
              {!mapPreviewUrl && (
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              )}
            </div>
            
            {/* Location Info */}
            <div className="p-2 bg-black/5 dark:bg-white/5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  {locationData.name ? (
                    <p className="text-sm font-medium truncate">{locationData.name}</p>
                  ) : hasCoords ? (
                    <p className="text-xs opacity-70">{locationData.lat?.toFixed(6)}, {locationData.lng?.toFixed(6)}</p>
                  ) : (
                    <p className="text-sm">Ver localização</p>
                  )}
                </div>
                <ExternalLink className="h-3 w-3 opacity-50 flex-shrink-0" />
              </div>
            </div>
          </div>
        );
      }
      
      default:
        return (
          <p className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-inherit">
            {content}
          </p>
        );
    }
  };

  return (
    <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-1`}>
      <div
        className={`max-w-[65%] rounded-lg px-3 py-1.5 shadow-sm ${
          isSent 
            ? `${themeClasses.messageSent} rounded-tr-none` 
            : `${themeClasses.messageReceived} rounded-tl-none`
        }`}
      >
        {renderContent()}
        
        <div className={`flex items-center justify-end gap-1 mt-0.5 ${themeClasses.messageTime}`}>
          <span className="text-[11px]">
            {formatMessageTime(message.created_at)}
          </span>
          {isSent && (
            <CheckCheck className="h-4 w-4 text-[#53BDEB]" />
          )}
        </div>
      </div>
    </div>
  );
}
