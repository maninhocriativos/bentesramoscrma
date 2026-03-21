import ChatInbox from '@/components/manychat/ChatInbox';
import { ChatProvider } from '@/contexts/ChatContext';

const ChatPage = () => {
  return (
    <ChatProvider>
      <ChatInbox />
    </ChatProvider>
  );
};

export default ChatPage;
