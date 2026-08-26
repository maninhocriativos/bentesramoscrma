import { memo } from 'react';
import { LeadsTableView } from '@/components/leads/LeadsTableView';

function LeadsPage() {
  return (
    <>
      <div className="flex flex-col h-full overflow-hidden">
        <LeadsTableView />
      </div>
    </>
  );
}

export default memo(LeadsPage);
