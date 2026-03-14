import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layouts/AppLayout';
import { AppHeader } from '@/components/AppHeader';

export default function PeticaoSaidaPage() {
  const navigate = useNavigate();
  const { id } = useParams();

  useEffect(() => {
    if (id) {
      navigate(`/peticoes/${id}/revisao`, { replace: true });
    } else {
      navigate('/peticoes', { replace: true });
    }
  }, [id, navigate]);

  return (
    <AppLayout>
      <AppHeader title="Redirecionando..." />
      <div className="flex-1" />
    </AppLayout>
  );
}
