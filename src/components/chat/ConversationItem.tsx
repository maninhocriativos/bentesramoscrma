import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, UserRound } from 'lucide-react';
import { ChatSubscriber } from '@/hooks/useChatSubscribers';
import { ChannelIcon } from './ChannelIcon';
import { getDisplayName, getInitials, formatLastMessageTime } from '@/lib/chatUtils';

interface ConversationItemProps {
  subscriber: ChatSubscriber;
  isSelected: boolean;
  onClick: () => void;
  lastMessage?: string;
  themeClasses: {
    hover: string;
    active: string;
    headerText: string;
    secondaryText: string;
    border: string;
  };
}

export function ConversationItem({ 
  subscriber, 
  isSelected, 
  onClick, 
  lastMessage,
  themeClasses 
}: ConversationItemProps) {
  const displayName = getDisplayName(subscriber);
  const initials = getInitials(subscriber);

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b ${themeClasses.border} ${
        isSelected ? themeClasses.active : themeClasses.hover
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={subscriber.foto} alt={displayName} />
          <AvatarFallback className="bg-[#00A884] text-white text-sm font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {/* Bot/Human indicator */}
        <div className="absolute -bottom-0.5 -right-0.5">
          {subscriber.atendimento_humano ? (
            <div className="bg-amber-500 rounded-full p-0.5">
              <UserRound className="h-3 w-3 text-white" />
            </div>
          ) : (
            <div className="bg-[#00A884] rounded-full p-0.5">
              <Bot className="h-3 w-3 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`font-medium truncate ${themeClasses.headerText}`}>
              {displayName}
            </span>
            <ChannelIcon canal={subscriber.canal} size="sm" />
          </div>
          
          {subscriber.ultima_interacao && (
            <span className={`text-xs flex-shrink-0 ${themeClasses.secondaryText}`}>
              {formatLastMessageTime(subscriber.ultima_interacao)}
            </span>
          )}
        </div>
        
        <p className={`text-sm truncate mt-0.5 ${themeClasses.secondaryText}`}>
          {lastMessage || 'Nenhuma mensagem'}
        </p>
      </div>
    </div>
  );
}
