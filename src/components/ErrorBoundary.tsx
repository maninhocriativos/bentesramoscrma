import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; message: string }

/**
 * Captura erros de render de qualquer página. Em vez de tela branca, mostra uma
 * tela de recuperação (limpa caches + Service Worker e recarrega). Estilo inline
 * de propósito: não depende de CSS/tokens que podem não ter carregado.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Erro de render capturado:', error);
  }

  handleRecover = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch {
      /* recarrega mesmo assim */
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#faf7f2', padding: 24, fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{
          maxWidth: 420, textAlign: 'center', background: '#fff', borderRadius: 16,
          padding: '32px 28px', border: '1px solid #e8ddd0', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#3d2b1f', margin: '0 0 8px' }}>
            Não foi possível carregar a página
          </h1>
          <p style={{ fontSize: 13.5, color: '#8a7260', margin: '0 0 20px', lineHeight: 1.5 }}>
            Isso costuma acontecer após uma atualização do sistema. Clique abaixo para
            recarregar com a versão mais recente.
          </p>
          <button
            onClick={this.handleRecover}
            style={{
              background: '#3d2b1f', color: '#c9a96e', border: 'none', borderRadius: 10,
              padding: '11px 22px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Recarregar
          </button>
          {this.state.message && (
            <p style={{ fontSize: 11, color: '#b09880', marginTop: 16, wordBreak: 'break-word' }}>
              {this.state.message}
            </p>
          )}
        </div>
      </div>
    );
  }
}
