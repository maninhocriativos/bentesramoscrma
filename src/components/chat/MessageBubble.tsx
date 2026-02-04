import { CheckCheck, Download, MapPin, ExternalLink, X } from 'lucide-react';
import { formatMessageTime, detectMediaType, extractLocationData } from '@/lib/chatUtils';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AudioPlayer } from './AudioPlayer';

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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const renderContent = () => {
    switch (mediaType) {
      case 'audio': {
        return <AudioPlayer message={message} isSent={isSent} />;
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
        const metadata = message.metadata as any;
        
        // Tentar extrair nome do documento
        let docName = metadata?.original?.document?.fileName 
          || metadata?.original?.document?.title 
          || metadata?.fileName
          || content.split('/').pop()?.split('?')[0]
          || 'Documento';
          
        // Remover extensão estranha
        if (docName.length > 50) docName = docName.substring(0, 50) + '...';
        
        // Detectar tipo de documento para ícone adequado
        const extension = docUrl.toLowerCase().split('.').pop()?.split('?')[0] || '';
        const isPDF = extension === 'pdf' || docUrl.includes('acrobat.adobe') || docUrl.includes('.pdf');
        const isWord = ['doc', 'docx'].includes(extension);
        const isExcel = ['xls', 'xlsx'].includes(extension);
        const isZip = ['zip', 'rar', '7z'].includes(extension);
        
        const getDocIcon = () => {
          if (isPDF) return '📕';
          if (isWord) return '📘';
          if (isExcel) return '📗';
          if (isZip) return '📦';
          return '📄';
        };
        
        const getDocTypeLabel = () => {
          if (isPDF) return 'PDF';
          if (isWord) return 'Word';
          if (isExcel) return 'Excel';
          if (isZip) return 'Arquivo';
          return extension.toUpperCase() || 'DOC';
        };
        
        return (
          <a 
            href={docUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors min-w-[200px] max-w-[280px] group"
          >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-500/10 dark:bg-red-400/20 rounded-lg text-2xl">
              {getDocIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-blue-500 transition-colors">
                {docName}
              </p>
              <p className="text-xs opacity-60 flex items-center gap-1">
                <span>{getDocTypeLabel()}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Download className="h-3 w-3" />
                  Abrir
                </span>
              </p>
            </div>
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
          <p 
            className="whitespace-pre-wrap break-words text-[14.2px] leading-[19px] text-inherit select-text cursor-text"
            style={{ whiteSpace: 'pre-wrap' }}
          >
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
