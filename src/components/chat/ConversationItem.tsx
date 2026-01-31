import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bot, UserRound } from 'lucide-react';
import { ChatSubscriber } from '@/hooks/useChatSubscribers';
import { ChannelIcon } from './ChannelIcon';
import { InstanceBadge } from './InstanceBadge';
import { getDisplayName, getInitials, formatLastMessageTime } from '@/lib/chatUtils';
import { getInstanceFromPhone } from '@/lib/instanceUtils';

interface ConversationItemProps {
  subscriber: ChatSubscriber;
  isSelected: boolean;
  onClick: () => void;
  lastMessage?: string;
  unreadCount?: number;
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
  unreadCount = 0,
  themeClasses 
}: ConversationItemProps) {
  const displayName = getDisplayName(subscriber);
  const initials = getInitials(subscriber);
  
  // Detect which instance this subscriber belongs to
  const instanceInfo = getInstanceFromPhone(subscriber.telefone);

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
            {/* Instance badge */}
            {instanceInfo && <InstanceBadge instance={instanceInfo} size="sm" />}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {subscriber.ultima_interacao && (
              <span className={`text-xs ${themeClasses.secondaryText}`}>
                {formatLastMessageTime(subscriber.ultima_interacao)}
              </span>
            )}
            {/* Unread count badge */}
            {unreadCount > 0 && (
              <span className="bg-[#00A884] text-white text-[11px] font-medium rounded-full min-w-[20px] h-5 flex items-center justify-center px-1.5">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
        </div>
        
        <p className={`text-sm truncate mt-0.5 ${themeClasses.secondaryText}`}>
          {lastMessage || 'Nenhuma mensagem'}
        </p>
      </div>
    </div>
  );
}
