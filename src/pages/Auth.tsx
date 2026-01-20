import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Loader2 } from 'lucide-react';
import logo from '@/assets/logo-bentes-ramos.png';

// Schema for login - simpler validation
const loginSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100),
});

// Schema for registration - stronger password requirements
const registerSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z
    .string()
    .min(8, 'Senha deve ter no mínimo 8 caracteres')
    .max(100)
    .regex(/[a-z]/, 'Senha deve conter pelo menos uma letra minúscula')
    .regex(/[A-Z]/, 'Senha deve conter pelo menos uma letra maiúscula')
    .regex(/[0-9]/, 'Senha deve conter pelo menos um número'),
});

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithGoogle, user, loading } = useAuth();
  const { toast } = useToast();
  
  // Check if there's an invited email in the URL
  const invitedEmail = searchParams.get('email') || '';
  const isInvited = !!invitedEmail;
  const notApproved = searchParams.get('not_approved') === 'true';
  
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [activeTab, setActiveTab] = useState(isInvited ? 'register' : 'login');
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  const [showNotApprovedMessage, setShowNotApprovedMessage] = useState(notApproved);

  // Handle OAuth callback - check for hash fragment with tokens
  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const errorDescription = hashParams.get('error_description');
    
    if (errorDescription) {
      toast({
        title: 'Erro no login',
        description: decodeURIComponent(errorDescription),
        variant: 'destructive',
      });
      // Clear the hash
      window.history.replaceState(null, '', location.pathname);
      return;
    }
    
    if (accessToken) {
      setIsProcessingOAuth(true);
      // The Supabase client will automatically handle the token from the hash
      // Just wait for the auth state to update
    }
  }, [location.hash, toast, location.pathname]);

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate]);

  const validateForm = (isRegistration = false) => {
    const schema = isRegistration ? registerSchema : loginSchema;
    const result = schema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;

    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Erro ao entrar',
        description: error.message === 'Invalid login credentials' 
          ? 'Email ou senha incorretos' 
          : error.message,
        variant: 'destructive',
      });
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;

    setIsSubmitting(true);
    const { error } = await signUp(email, password);
    setIsSubmitting(false);

    if (error) {
      const message = error.message.includes('already registered')
        ? 'Este email já está cadastrado'
        : error.message;
      toast({
        title: 'Erro ao criar conta',
        description: message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Sua conta foi criada e está aguardando aprovação do administrador. Você será notificado por email.',
      });
      setEmail('');
      setPassword('');
      setActiveTab('login');
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    const { error } = await signInWithGoogle();
    setIsSubmitting(false);

    if (error) {
      toast({
        title: 'Erro ao entrar com Google',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // Show loading while checking auth state or processing OAuth callback
  if (loading || isProcessingOAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {isProcessingOAuth ? 'Processando login...' : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md rounded-2xl shadow-soft-lg animate-fade-in">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <img 
              src={logo} 
              alt="Bentes Ramos" 
              className="h-[80px] w-auto object-contain"
            />
          </div>
          <CardDescription className="text-muted-foreground">
            Sistema de Gestão Jurídica
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {showNotApprovedMessage && (
            <Alert className="mb-4 bg-amber-50 border-amber-200">
              <AlertDescription className="text-amber-800">
                Sua conta ainda não foi aprovada. Aguarde a aprovação do administrador.
              </AlertDescription>
            </Alert>
          )}

          {isInvited && (
            <Alert className="mb-4 bg-primary/10 border-primary/20">
              <UserPlus className="h-4 w-4" />
              <AlertDescription>
                Você foi convidado para a equipe! Crie sua conta para começar.
              </AlertDescription>
            </Alert>
          )}

          {/* Google Sign In Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl mb-4 h-11 gap-3 hover:bg-muted/50 transition-colors"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar com Google
          </Button>

          <div className="relative mb-4">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
              ou
            </span>
          </div>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl mb-6">
              <TabsTrigger value="login" className="rounded-lg">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl"
                    placeholder="seu@email.com"
                    required
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{errors.email}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl"
                    placeholder="••••••••"
                    required
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                </div>
                
                <Button 
                  type="submit" 
                  className="w-full rounded-xl"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Entrando...' : 'Entrar'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div>
                  <Label htmlFor="register-email">Email</Label>
                  <Input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="rounded-xl"
                    placeholder="seu@email.com"
                    required
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive mt-1">{errors.email}</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="register-password">Senha</Label>
                  <Input
                    id="register-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl"
                    placeholder="Senha forte"
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Mínimo 8 caracteres, com letra maiúscula, minúscula e número
                  </p>
                  {errors.password && (
                    <p className="text-sm text-destructive mt-1">{errors.password}</p>
                  )}
                </div>

                <Alert className="bg-amber-50 border-amber-200 text-amber-800">
                  <AlertDescription className="text-xs">
                    Após o cadastro, sua conta precisará ser aprovada por um administrador antes de você poder acessar o sistema.
                  </AlertDescription>
                </Alert>
                
                <Button 
                  type="submit" 
                  className="w-full rounded-xl"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Criando conta...' : 'Criar Conta'}
              </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Links obrigatórios para verificação Google */}
          <div className="mt-6 pt-4 border-t border-border/50 text-center">
            <p className="text-xs text-muted-foreground mb-2">
              Ao continuar, você concorda com nossos termos
            </p>
            <div className="flex justify-center gap-4 text-xs">
              <a 
                href="/politica-privacidade" 
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Política de Privacidade
              </a>
              <span className="text-muted-foreground">•</span>
              <a 
                href="/termos-servico" 
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Termos de Serviço
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
