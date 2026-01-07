import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Download, 
  Smartphone, 
  Phone, 
  MessageSquare, 
  Bell, 
  Wifi,
  Check,
  Share,
  PlusSquare,
  ArrowDown
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const InstallPage = () => {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Detectar dispositivo
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Verificar se já está instalado
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Capturar evento de instalação (Android/Chrome)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const features = [
    { icon: Phone, title: 'Ligações Diretas', description: 'Ligue para clientes com um toque' },
    { icon: MessageSquare, title: 'WhatsApp Integrado', description: 'Envie mensagens rapidamente' },
    { icon: Bell, title: 'Notificações', description: 'Receba alertas de compromissos' },
    { icon: Wifi, title: 'Funciona Offline', description: 'Acesse dados sem internet' },
  ];

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#1a1f2e] flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-[#1a1f2e]/80 border-[#2a3f5f] backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-20 w-20 rounded-2xl bg-gradient-to-br from-[#00A884] to-[#008069] flex items-center justify-center">
              <Check className="h-10 w-10 text-white" />
            </div>
            <CardTitle className="text-2xl text-white">App Instalado!</CardTitle>
            <CardDescription className="text-gray-400">
              O CRM já está na sua tela inicial
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => navigate('/dashboard')} 
              className="w-full bg-[#00A884] hover:bg-[#008069] text-white"
            >
              Ir para o Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0f1a] to-[#1a1f2e] p-4 pb-8">
      <div className="max-w-md mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-24 w-24 rounded-2xl bg-gradient-to-br from-[#1a365d] to-[#2a4a7f] flex items-center justify-center shadow-2xl">
            <Smartphone className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Instalar CRM</h1>
          <p className="text-gray-400">
            Acesse o sistema como um app nativo no seu celular
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {features.map((feature) => (
            <Card key={feature.title} className="bg-[#1a1f2e]/60 border-[#2a3f5f] backdrop-blur">
              <CardContent className="p-4 text-center">
                <feature.icon className="h-8 w-8 text-[#00A884] mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white mb-1">{feature.title}</h3>
                <p className="text-xs text-gray-500">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Install Instructions */}
        <Card className="bg-[#1a1f2e]/80 border-[#2a3f5f] backdrop-blur-xl mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <Download className="h-5 w-5 text-[#00A884]" />
              Como instalar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Android com prompt disponível */}
            {deferredPrompt && (
              <Button 
                onClick={handleInstall}
                className="w-full bg-[#00A884] hover:bg-[#008069] text-white h-14 text-lg"
              >
                <Download className="h-6 w-6 mr-2" />
                Instalar Agora
              </Button>
            )}

            {/* iOS Instructions */}
            {isIOS && !deferredPrompt && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0f1a]/50">
                  <div className="h-8 w-8 rounded-full bg-[#007AFF] flex items-center justify-center shrink-0">
                    <Share className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">1. Toque em Compartilhar</p>
                    <p className="text-gray-500 text-sm">No Safari, toque no ícone de compartilhar</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0f1a]/50">
                  <div className="h-8 w-8 rounded-full bg-[#007AFF] flex items-center justify-center shrink-0">
                    <PlusSquare className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">2. Adicionar à Tela de Início</p>
                    <p className="text-gray-500 text-sm">Role e toque em "Adicionar à Tela de Início"</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0f1a]/50">
                  <div className="h-8 w-8 rounded-full bg-[#00A884] flex items-center justify-center shrink-0">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">3. Confirmar</p>
                    <p className="text-gray-500 text-sm">Toque em "Adicionar" para instalar</p>
                  </div>
                </div>
              </div>
            )}

            {/* Android Instructions (sem prompt) */}
            {isAndroid && !deferredPrompt && (
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0f1a]/50">
                  <div className="h-8 w-8 rounded-full bg-[#00A884] flex items-center justify-center shrink-0">
                    <span className="text-white font-bold">⋮</span>
                  </div>
                  <div>
                    <p className="text-white font-medium">1. Abra o Menu</p>
                    <p className="text-gray-500 text-sm">Toque nos 3 pontos no Chrome</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-lg bg-[#0a0f1a]/50">
                  <div className="h-8 w-8 rounded-full bg-[#00A884] flex items-center justify-center shrink-0">
                    <Download className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-medium">2. Instalar aplicativo</p>
                    <p className="text-gray-500 text-sm">Toque em "Instalar aplicativo"</p>
                  </div>
                </div>
              </div>
            )}

            {/* Desktop */}
            {!isIOS && !isAndroid && !deferredPrompt && (
              <div className="text-center py-4">
                <Smartphone className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">
                  Acesse esta página no seu celular para instalar o app
                </p>
                <div className="mt-4 p-3 rounded-lg bg-[#0a0f1a]/50">
                  <p className="text-xs text-gray-500 mb-2">URL para acessar:</p>
                  <code className="text-[#00A884] text-sm break-all">
                    {window.location.origin}/install
                  </code>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Skip */}
        <Button 
          variant="ghost" 
          onClick={() => navigate('/auth')}
          className="w-full text-gray-500 hover:text-white"
        >
          Continuar no navegador
        </Button>
      </div>
    </div>
  );
};

export default InstallPage;
