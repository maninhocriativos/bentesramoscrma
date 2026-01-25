import { CheckCheck } from 'lucide-react';
import { formatMessageTime, detectMediaType } from '@/lib/chatUtils';
import { ChatMessage } from '@/hooks/useChatMessages';

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

export function MessageBubble({ message, themeClasses }: MessageBubbleProps) {
  const isSent = message.direcao === 'saida';
  const content = message.conteudo || '';
  const mediaType = detectMediaType(content, message.tipo);
  const cleanUrl = content.replace(/^\[|\]$/g, '');

  const renderContent = () => {
    switch (mediaType) {
      case 'audio':
        return (
          <audio controls className="max-w-[220px] h-10" preload="metadata">
            <source src={cleanUrl} type="audio/ogg" />
          </audio>
        );
      
      case 'image':
        return (
          <img 
            src={cleanUrl} 
            alt="Imagem" 
            className="max-w-[280px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(cleanUrl, '_blank')}
          />
        );
      
      case 'video':
        return (
          <video controls className="max-w-[280px] rounded-lg" preload="metadata">
            <source src={cleanUrl} />
          </video>
        );
      
      case 'document':
        return (
          <a 
            href={cleanUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-500 hover:underline"
          >
            📄 {content.split('/').pop() || 'Documento'}
          </a>
        );
      
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
