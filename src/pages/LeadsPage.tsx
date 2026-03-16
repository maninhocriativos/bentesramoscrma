import { AppLayout } from '@/components/layouts/AppLayout';
import { LeadsTableView } from '@/components/leads/LeadsTableView';

export default function LeadsPage() {
  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-hidden">
        <LeadsTableView />
      </div>
    </AppLayout>
  );
}
