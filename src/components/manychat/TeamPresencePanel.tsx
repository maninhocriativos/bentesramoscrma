import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Users, MessageCircle, Headphones } from 'lucide-react';
import { useChatTheme } from './ChatThemeProvider';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TeamMemberWithStatus {
  id: string;
  nome: string | null;
  sobrenome: string | null;
  cargo: string | null;
  email: string | null;
  online: boolean;
  currentChat?: string;
  fullName: string;
}

interface TeamPresencePanelProps {
  teamMembers: TeamMemberWithStatus[];
  currentUserId?: string;
  onClose: () => void;
  onAssignToMember: (memberId: string) => void;
  subscriberName?: string;
  isAssigning?: boolean;
}

export function TeamPresencePanel({
  teamMembers,
  currentUserId,
  onClose,
  onAssignToMember,
  subscriberName,
  isAssigning = false,
}: TeamPresencePanelProps) {
  const { theme } = useChatTheme();
  const isDark = theme === 'dark';

  const themeClasses = {
    bg: isDark ? 'bg-[#111B21]' : 'bg-white',
    header: isDark ? 'bg-[#202C33]' : 'bg-[#F0F2F5]',
    headerText: isDark ? 'text-[#E9EDEF]' : 'text-[#111B21]',
    secondaryText: isDark ? 'text-[#8696A0]' : 'text-[#667781]',
    border: isDark ? 'border-[#222D34]' : 'border-[#E9EDEF]',
    hover: isDark ? 'hover:bg-[#202C33]' : 'hover:bg-[#F5F6F6]',
    cardBg: isDark ? 'bg-[#1F2C34]' : 'bg-[#F0F2F5]',
  };

  const onlineMembers = teamMembers.filter(m => m.online && m.id !== currentUserId);
  const offlineMembers = teamMembers.filter(m => !m.online && m.id !== currentUserId);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  };

  const getRoleColor = (cargo: string | null) => {
    switch (cargo) {
      case 'Administrador': return 'bg-purple-500';
      case 'Gerente': return 'bg-blue-500';
      case 'Advogado': return 'bg-emerald-500';
      case 'Secretaria': return 'bg-amber-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className={`w-[320px] flex flex-col ${themeClasses.bg} border-l ${themeClasses.border}`}>
      {/* Header */}
      <div className={`h-[60px] px-4 flex items-center justify-between ${themeClasses.header}`}>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#00A884] to-[#008069] flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className={`font-semibold ${themeClasses.headerText}`}>Equipe</h3>
            <p className={`text-xs ${themeClasses.secondaryText}`}>
              {onlineMembers.length} online
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className={`h-9 w-9 rounded-full ${themeClasses.secondaryText}`}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Assign header */}
      {isAssigning && subscriberName && (
        <div className={`px-4 py-3 ${themeClasses.cardBg} border-b ${themeClasses.border}`}>
          <p className={`text-sm ${themeClasses.secondaryText}`}>
            Direcionar conversa com
          </p>
          <p className={`font-medium ${themeClasses.headerText}`}>
            {subscriberName}
          </p>
        </div>
      )}

      <ScrollArea className="flex-1">
        {/* Online members */}
        {onlineMembers.length > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className={`text-xs font-medium uppercase tracking-wider ${themeClasses.secondaryText}`}>
                Online agora
              </span>
            </div>
            
            <div className="space-y-1">
              {onlineMembers.map(member => (
                <div
                  key={member.id}
                  onClick={() => isAssigning && onAssignToMember(member.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    isAssigning ? `cursor-pointer ${themeClasses.hover}` : ''
                  } ${themeClasses.cardBg}`}
                >
                  <div className="relative">
                    <Avatar className="h-11 w-11">
                      <AvatarFallback className={`${getRoleColor(member.cargo)} text-white text-sm font-medium`}>
                        {getInitials(member.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-[#111B21]" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${themeClasses.headerText} truncate`}>
                      {member.fullName}
                    </p>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${themeClasses.secondaryText} truncate`}>
                        {member.cargo}
                      </span>
                      {member.currentChat && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-500">
                          <Headphones className="h-3 w-3" />
                          <span>atendendo</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {isAssigning && (
                    <Button
                      size="sm"
                      className="h-8 px-3 bg-[#00A884] hover:bg-[#008069] text-white text-xs"
                    >
                      Direcionar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Offline members */}
        {offlineMembers.length > 0 && (
          <div className="p-3">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="h-2 w-2 rounded-full bg-gray-400" />
              <span className={`text-xs font-medium uppercase tracking-wider ${themeClasses.secondaryText}`}>
                Offline
              </span>
            </div>
            
            <div className="space-y-1">
              {offlineMembers.map(member => (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 p-3 rounded-xl opacity-60 ${themeClasses.cardBg}`}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarFallback className="bg-gray-400 text-white text-sm font-medium">
                      {getInitials(member.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${themeClasses.headerText} truncate`}>
                      {member.fullName}
                    </p>
                    <span className={`text-xs ${themeClasses.secondaryText}`}>
                      {member.cargo}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {teamMembers.filter(m => m.id !== currentUserId).length === 0 && (
          <div className={`p-8 text-center ${themeClasses.secondaryText}`}>
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum membro da equipe</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
