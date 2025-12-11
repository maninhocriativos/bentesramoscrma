import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';
import ManyChatInbox from '@/components/manychat/ManyChatInbox';

const ManyChatPage = () => {
  return (
    <AppLayout>
      
      
      <AppHeader title="ManyChat Inbox" />
      
      <div className="p-6">
        <ManyChatInbox />
      </div>
    </AppLayout>
  );
};

export default ManyChatPage;
