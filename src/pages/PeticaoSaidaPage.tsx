import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';

// Redirect to revisao page - this page is no longer needed separately
export default function PeticaoSaidaPage() {
  const navigate = useNavigate();
  // Redirect to peticoes
  navigate('/peticoes', { replace: true });
  return (
    <AppLayout>
      <AppHeader title="Redirecionando..." />
      <div className="flex-1" />
    </AppLayout>
  );
}
