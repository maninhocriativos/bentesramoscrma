import { useEffect } from 'react';

// Esta página é aberta no popup após o OAuth do Google.
// Ela lê os tokens da URL, envia para a janela pai e fecha.
export default function GoogleAuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleAuth = params.get('google_auth');

    if (googleAuth === 'success') {
      const tokens = {
        access_token:  params.get('access_token')  || '',
        refresh_token: params.get('refresh_token') || '',
        expires_in:    parseInt(params.get('expires_in') || '3600', 10),
      };

      // Enviar tokens para a janela pai (AgendaPage)
      if (window.opener) {
        window.opener.postMessage({ type: 'google-oauth-success', tokens }, '*');
        setTimeout(() => window.close(), 500);
      } else {
        // Fallback: salvar no sessionStorage e redirecionar
        sessionStorage.setItem('google_oauth_tokens', JSON.stringify(tokens));
        window.location.href = '/agenda';
      }
    } else if (googleAuth === 'error') {
      const reason = params.get('reason') || 'Erro desconhecido';
      if (window.opener) {
        window.opener.postMessage({ type: 'google-oauth-error', error: reason }, '*');
        setTimeout(() => window.close(), 500);
      } else {
        window.location.href = '/agenda?google_error=' + encodeURIComponent(reason);
      }
    } else {
      // Sem parâmetros, fechar ou redirecionar
      if (window.opener) window.close();
      else window.location.href = '/agenda';
    }
  }, []);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      background: '#3d2b1f', color: '#c9a96e',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Google Calendar Conectado!</h1>
      <p style={{ fontSize: 14, opacity: 0.6 }}>Esta janela será fechada automaticamente...</p>
    </div>
  );
}
