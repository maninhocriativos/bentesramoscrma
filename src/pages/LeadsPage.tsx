import { memo } from 'react';
import { AppLayout } from '@/components/layouts/AppLayout';
import { LeadsTableView } from '@/components/leads/LeadsTableView';

function LeadsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <LeadsTableView />
      </div>
    </AppLayout>
  );
}

export default memo(LeadsPage);
