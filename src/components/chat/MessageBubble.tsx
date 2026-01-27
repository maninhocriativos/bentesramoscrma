import { CheckCheck, Play, Download } from 'lucide-react';
import { formatMessageTime, detectMediaType } from '@/lib/chatUtils';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useRef, useState } from 'react';

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
          <img 
            src={displayUrl} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(displayUrl, '_blank')}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
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
