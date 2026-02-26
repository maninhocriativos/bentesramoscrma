import { CheckCheck, Check, Download, MapPin, ExternalLink, X, Reply, Clock } from 'lucide-react';
import { formatMessageTime, detectMediaType, extractLocationData } from '@/lib/chatUtils';
import { formatWhatsAppText } from '@/lib/whatsappTextFormatter';
import { ChatMessage } from '@/hooks/useChatMessages';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { WhatsAppAudioPlayer } from './WhatsAppAudioPlayer';
import { LinkPreview, extractUrls, isOnlyUrl } from './LinkPreview';
import { cn } from '@/lib/utils';

interface WhatsAppMessageBubbleProps {
  message: ChatMessage;
  themeClasses: {
    messageSent: string;
    messageReceived: string;
    messageSentText: string;
    messageReceivedText: string;
    messageTime: string;
  };
  onReply?: (message: ChatMessage) => void;
}

function extractImageUrl(message: ChatMessage): string | null {
  const metadata = message.metadata as any;
  if (metadata?.original?.image?.imageUrl) return metadata.original.image.imageUrl;
  if (metadata?.original?.image?.link) return metadata.original.image.link;
  if (metadata?.media_url) return metadata.media_url;
  
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)/i)) return cleanUrl;
  return null;
}

function extractStickerUrl(message: ChatMessage): string | null {
  const metadata = message.metadata as any;
  if (metadata?.original?.sticker?.stickerUrl) return metadata.original.sticker.stickerUrl;
  if (metadata?.original?.sticker?.link) return metadata.original.sticker.link;
  if (metadata?.original?.sticker?.url) return metadata.original.sticker.url;
  if (metadata?.media_url) return metadata.media_url;
  
  const content = message.conteudo || '';
  const cleanUrl = content.replace(/^\[|\]$/g, '').trim();
  if (cleanUrl.match(/^https?:\/\/.+/i)) return cleanUrl;
  return null;
}

// Get delivery status from metadata
function getDeliveryStatus(message: ChatMessage): 'sending' | 'sent' | 'delivered' | 'read' {
  const metadata = message.metadata as any;
  
  // Check if message is still being sent
  if (metadata?.status === 'sending' || metadata?.pending) return 'sending';
  
  // Check Z-API status
  const zapiStatus = metadata?.original?.status || metadata?.status;
  if (zapiStatus === 'read' || zapiStatus === 'READ') return 'read';
  if (zapiStatus === 'delivered' || zapiStatus === 'DELIVERED') return 'delivered';
  if (zapiStatus === 'sent' || zapiStatus === 'SENT') return 'sent';
  
  // Default for outbound messages
  return 'sent';
}

export function WhatsAppMessageBubble({ message, themeClasses, onReply }: WhatsAppMessageBubbleProps) {
  const isSent = message.direcao === 'saida';
  const content = message.conteudo || '';
  const mediaType = detectMediaType(content, message.tipo);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showReplyOption, setShowReplyOption] = useState(false);
  
  // Extract URLs for link preview (must be at top level for hooks rules)
  const urls = useMemo(() => extractUrls(content), [content]);
  const showFullPreview = urls.length === 1 && isOnlyUrl(content);
  
  const deliveryStatus = isSent ? getDeliveryStatus(message) : null;

  const renderDeliveryIcon = () => {
    if (!deliveryStatus) return null;
    
    switch (deliveryStatus) {
      case 'sending':
        return <Clock className="h-3.5 w-3.5 opacity-60" />;
      case 'sent':
        return <Check className="h-3.5 w-3.5 opacity-70" />;
      case 'delivered':
        return <CheckCheck className="h-3.5 w-3.5 opacity-70" />;
      case 'read':
        return <CheckCheck className="h-3.5 w-3.5 text-[#53BDEB]" />;
      default:
        return <Check className="h-3.5 w-3.5 opacity-70" />;
    }
  };

  const renderContent = () => {
    switch (mediaType) {
      case 'audio':
        return <WhatsAppAudioPlayer message={message} isSent={isSent} />;
      
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
        
        let docName = metadata?.original?.document?.fileName 
          || metadata?.original?.document?.title 
          || metadata?.fileName
          || content.split('/').pop()?.split('?')[0]
          || 'Documento';
          
        if (docName.length > 50) docName = docName.substring(0, 50) + '...';
        
        const extension = docUrl.toLowerCase().split('.').pop()?.split('?')[0] || '';
        const isPDF = extension === 'pdf' || docUrl.includes('.pdf');
        const isWord = ['doc', 'docx'].includes(extension);
        const isExcel = ['xls', 'xlsx'].includes(extension);
        
        const getDocIcon = () => {
          if (isPDF) return '📕';
          if (isWord) return '📘';
          if (isExcel) return '📗';
          return '📄';
        };
        
        return (
          <a 
            href={docUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 rounded-lg bg-black/5 hover:bg-black/10 transition-colors min-w-[200px] max-w-[280px] group"
          >
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-red-500/10 rounded-lg text-2xl">
              {getDocIcon()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate group-hover:text-blue-500 transition-colors">
                {docName}
              </p>
              <p className="text-xs opacity-60 flex items-center gap-1">
                <Download className="h-3 w-3" />
                Abrir
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
            <div className="relative bg-gradient-to-br from-emerald-500/20 to-teal-600/20 h-[120px] flex items-center justify-center">
              {mapPreviewUrl ? (
                <img src={mapPreviewUrl} alt="Mapa" className="w-full h-full object-cover" />
              ) : (
                <MapPin className="h-10 w-10 text-emerald-600" />
              )}
            </div>
            <div className="p-2 bg-black/5">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                <p className="text-sm truncate flex-1">{locationData.name || 'Ver localização'}</p>
                <ExternalLink className="h-3 w-3 opacity-50" />
              </div>
            </div>
          </div>
        );
      }
      
      default: {
        // Only apply WhatsApp formatting to messages NOT sent from the chat interface
        const metadata = message.metadata as any;
        const sentFromInterface = metadata?.sent_via === 'chat_interface';
        
        return (
          <div className="space-y-2">
            {/* Text content */}
            {!showFullPreview && (
              <div className="text-[14.2px] leading-[19px] text-inherit select-text cursor-text whitespace-pre-wrap break-words">
                {sentFromInterface ? content : formatWhatsAppText(content)}
              </div>
            )}
            
            {/* Link previews */}
            {urls.slice(0, 2).map((url, index) => (
              <LinkPreview 
                key={`${url}-${index}`} 
                url={url}
                className={showFullPreview ? '' : 'mt-2'}
              />
            ))}
          </div>
        );
      }
    }
  };

  return (
    <div 
      className={cn("flex mb-1 group", isSent ? "justify-end" : "justify-start")}
      onMouseEnter={() => setShowReplyOption(true)}
      onMouseLeave={() => setShowReplyOption(false)}
    >
      {/* Reply button - left side for sent messages */}
      {isSent && onReply && showReplyOption && (
        <button
          onClick={() => onReply(message)}
          className="self-center mr-2 p-1.5 rounded-full bg-black/10 hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}

      <div className={cn("relative max-w-[65%]", isSent ? "order-1" : "order-2")}>
        {/* WhatsApp-style bubble tail */}
        <div
          className={cn(
            "absolute top-0 w-3 h-3",
            isSent 
              ? "right-[-6px] clip-path-tail-right" 
              : "left-[-6px] clip-path-tail-left",
            isSent ? themeClasses.messageSent : themeClasses.messageReceived
          )}
          style={{
            clipPath: isSent 
              ? 'polygon(0 0, 0 100%, 100% 0)' 
              : 'polygon(100% 0, 0 0, 100% 100%)'
          }}
        />
        
        <div
          className={cn(
            "rounded-lg px-3 py-1.5 shadow-sm",
            isSent 
              ? `${themeClasses.messageSent} rounded-tr-[4px]` 
              : `${themeClasses.messageReceived} rounded-tl-[4px]`
          )}
        >
          {renderContent()}
          
          <div className={cn("flex items-center justify-end gap-1 mt-0.5", themeClasses.messageTime)}>
            <span className="text-[11px]">
              {formatMessageTime(message.created_at)}
            </span>
            {isSent && renderDeliveryIcon()}
          </div>
        </div>
      </div>

      {/* Reply button - right side for received messages */}
      {!isSent && onReply && showReplyOption && (
        <button
          onClick={() => onReply(message)}
          className="self-center ml-2 p-1.5 rounded-full bg-black/10 hover:bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity order-3"
        >
          <Reply className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
