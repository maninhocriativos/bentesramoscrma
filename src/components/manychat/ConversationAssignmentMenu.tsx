import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { UserPlus, Headphones, Check } from 'lucide-react';

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

interface ConversationAssignmentMenuProps {
  teamMembers: TeamMemberWithStatus[];
  currentUserId?: string;
  currentAssignee?: string;
  onAssign: (memberId: string) => void;
  disabled?: boolean;
}

export function ConversationAssignmentMenu({
  teamMembers,
  currentUserId,
  currentAssignee,
  onAssign,
  disabled = false,
}: ConversationAssignmentMenuProps) {
  const onlineMembers = teamMembers.filter(m => m.online && m.id !== currentUserId);
  const allOthers = teamMembers.filter(m => m.id !== currentUserId);

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-10 w-10 rounded-full hover:bg-[#00A884]/10"
          title="Direcionar conversa"
        >
          <UserPlus className="h-5 w-5 text-[#00A884]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Direcionar para
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {onlineMembers.length > 0 && (
          <>
            <div className="px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            </div>
            {onlineMembers.map(member => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => onAssign(member.id)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className={`${getRoleColor(member.cargo)} text-white text-xs`}>
                      {getInitials(member.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border border-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.fullName}</p>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">{member.cargo}</span>
                    {member.currentChat && (
                      <Headphones className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </div>
                {currentAssignee === member.id && (
                  <Check className="h-4 w-4 text-[#00A884]" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        {allOthers.filter(m => !m.online).length > 0 && (
          <>
            <div className="px-2 py-1.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Offline
              </span>
            </div>
            {allOthers.filter(m => !m.online).map(member => (
              <DropdownMenuItem
                key={member.id}
                onClick={() => onAssign(member.id)}
                className="flex items-center gap-2 cursor-pointer opacity-60"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gray-400 text-white text-xs">
                    {getInitials(member.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.fullName}</p>
                  <span className="text-xs text-muted-foreground">{member.cargo}</span>
                </div>
                {currentAssignee === member.id && (
                  <Check className="h-4 w-4 text-[#00A884]" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {allOthers.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhum membro disponível
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
