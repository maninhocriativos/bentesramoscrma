import ChatInbox from '@/components/manychat/ChatInbox';
import { ChatInterno } from '@/components/tarefas/ChatInterno';
import { CriticalTasksAlert } from '@/components/tarefas/CriticalTasksAlert';

// /chat fica fora do AppLayoutRoute (tela cheia, sem sidebar) — por isso
// precisa montar aqui, à parte, os mesmos widgets globais que o AppLayout já
// dá pras outras 27 páginas: o chat interno da equipe (menções/mensagens) e
// o alerta de prazo crítico. Sem isso, quem passa o dia na tela de WhatsApp
// nunca via aviso nenhum dos dois.
const ChatPage = () => {
  return (
    <>
      <ChatInbox />
      <ChatInterno />
      <CriticalTasksAlert />
    </>
  );
};

export default ChatPage;
