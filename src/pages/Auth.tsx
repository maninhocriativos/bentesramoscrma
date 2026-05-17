import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Loader2, ArrowLeft, Mail, CheckCircle, Scale, Shield, Clock } from 'lucide-react';
import logo from '@/assets/logo-bentes-ramos.png';
import authBg from '@/assets/auth-bg.jpg';

// Schemas
const loginSchema = z.object({
  email: z.string().email('Email inválido').max(255),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(100),
});

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
  
  const invitedEmail = searchParams.get('email') || '';
  const isInvited = !!invitedEmail;
  const isPasswordReset = location.hash.includes('type=recovery');
  
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [activeTab, setActiveTab] = useState(isInvited ? 'register' : 'login');
  const [isProcessingOAuth, setIsProcessingOAuth] = useState(false);
  
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotEmailSent, setForgotEmailSent] = useState(false);
  const [sendingResetEmail, setSendingResetEmail] = useState(false);
  
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  // useEffects and handlers - handleSignIn, handleSignUp, handleGoogleSignIn, handleForgotPassword, handleResetPassword, validateForm
  useEffect(() => {
    const hashParams = new URLSearchParams(location.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const errorDescription = hashParams.get('error_description');
    const type = hashParams.get('type');
    
    if (errorDescription) {
      toast({
        title: 'Erro',
        description: decodeURIComponent(errorDescription),
        variant: 'destructive',
      });
      window.history.replaceState(null, '', location.pathname);
      return;
    }
    
    if (type === 'recovery' && accessToken) {
      setShowResetPassword(true);
      return;
    }
    
    if (accessToken) {
      setIsProcessingOAuth(true);
    }
  }, [location.hash, toast, location.pathname]);

  useEffect(() => {
    if (user && !loading && !showResetPassword) {
      navigate('/dashboard', { replace: true });
    }
  }, [user, loading, navigate, showResetPassword]);

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
      toast({ title: 'Erro ao criar conta', description: message, variant: 'destructive' });
    } else {
      toast({
        title: 'Conta criada!',
        description: 'Sua conta foi criada e está aguardando aprovação do administrador.',
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
      toast({ title: 'Erro ao entrar com Google', description: error.message, variant: 'destructive' });
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail || !z.string().email().safeParse(forgotEmail).success) {
      toast({ title: 'Email inválido', description: 'Por favor, insira um email válido.', variant: 'destructive' });
      return;
    }
    setSendingResetEmail(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setSendingResetEmail(false);
    if (error) {
      toast({ title: 'Erro ao enviar email', description: error.message, variant: 'destructive' });
    } else {
      setForgotEmailSent(true);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: 'Senha muito curta', description: 'A senha deve ter no mínimo 8 caracteres.', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Senhas não conferem', description: 'As senhas digitadas não são iguais.', variant: 'destructive' });
      return;
    }
    const passwordResult = registerSchema.shape.password.safeParse(newPassword);
    if (!passwordResult.success) {
      toast({ title: 'Senha fraca', description: passwordResult.error.errors[0]?.message || 'Senha não atende aos requisitos.', variant: 'destructive' });
      return;
    }
    setResettingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setResettingPassword(false);
    if (error) {
      toast({ title: 'Erro ao redefinir senha', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Senha redefinida!', description: 'Sua senha foi alterada com sucesso.' });
      setShowResetPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState(null, '', location.pathname);
      navigate('/dashboard', { replace: true });
    }
  };

  // Loading state
  if (loading || isProcessingOAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
          </div>
          <p className="text-primary-foreground/70 text-sm tracking-wide">
            {isProcessingOAuth ? 'Processando login...' : 'Carregando...'}
          </p>
        </div>
      </div>
    );
  }

  // Brand panel (left side)
  const BrandPanel = () => (
    <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
      {/* Background image */}
      <img 
        src={authBg} 
        alt="" 
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-primary/95" />
      
      {/* Content */}
      <div className="relative z-10 flex flex-col justify-between p-12 w-full">
        {/* Logo top */}
        <div>
          <img 
            src={logo} 
            alt="Bentes Ramos" 
            className="h-16 w-auto object-contain brightness-0 invert opacity-90"
          />
        </div>
        
        {/* Center content */}
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-primary-foreground/95 leading-tight tracking-tight">
              Sistema de Gestão
              <br />
              <span className="text-accent">Jurídica</span>
            </h1>
            <p className="mt-4 text-primary-foreground/60 text-base max-w-md leading-relaxed">
              Plataforma completa para gestão de clientes, processos e documentos do escritório Bentes Ramos Advocacia.
            </p>
          </div>
          
          {/* Features */}
          <div className="space-y-4">
            {[
              { icon: Scale, text: 'Gestão completa de processos e prazos' },
              { icon: Shield, text: 'Segurança e sigilo profissional' },
              { icon: Clock, text: 'Automação inteligente com IA' },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-center gap-3 text-primary-foreground/50">
                <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-accent/15 flex items-center justify-center">
                  <Icon className="h-4 w-4 text-accent" />
                </div>
                <span className="text-sm">{text}</span>
              </div>
            ))
          }
          </div>
        </div>
        
        {/* Bottom */}
        <p className="text-primary-foreground/30 text-xs">
          © {new Date().getFullYear()} Bentes Ramos Advocacia e Consultoria Jurídica
        </p>
      </div>
    </div>
  );

  // Form input styling
  const inputClasses = "h-12 rounded-xl bg-muted/50 border-border/60 focus:border-accent focus:ring-accent/20 transition-all duration-200 placeholder:text-muted-foreground/50";

  // Password Reset View
  if (showResetPassword) {
    return (
      <div className="min-h-screen flex">
        <BrandPanel />
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background">
          <div className="w-full max-w-[420px] space-y-8 animate-fade-in">
            <div className="lg:hidden flex justify-center mb-6">
              <img src={logo} alt="Bentes Ramos" className="h-16 w-auto object-contain" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">Redefinir Senha</h2>
              <p className="text-muted-foreground text-sm mt-1">Escolha uma nova senha para sua conta</p>
            </div>
            
            <form onSubmit={handleResetPassword} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Nova Senha</Label>
                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputClasses} placeholder="Digite sua nova senha" required autoFocus />
                <p className="text-xs text-muted-foreground/70">Mínimo 8 caracteres, com maiúscula, minúscula e número</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Confirmar Senha</Label>
                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClasses} placeholder="Confirme sua nova senha" required />
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all duration-200" disabled={resettingPassword}>
                {resettingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Redefinindo...</> : 'Redefinir Senha'}
              </Button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <BrandPanel />
      
      {/* Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative">
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        
        <div className="relative z-10 w-full max-w-[420px] space-y-8 animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-2 mb-4">
            <img src={logo} alt="Bentes Ramos" className="h-20 w-auto object-contain" />
            <p className="text-muted-foreground text-sm">Sistema de Gestão Jurídica</p>
          </div>

          {/* Welcome text (desktop) */}
          <div className="hidden lg:block">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">
              {activeTab === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {activeTab === 'login' 
                ? 'Acesse sua conta para continuar' 
                : 'Preencha seus dados para começar'}
            </p>
          </div>

          {isInvited && (
            <Alert className="bg-accent/10 border-accent/20 rounded-xl">
              <UserPlus className="h-4 w-4 text-accent" />
              <AlertDescription className="text-sm">
                Você foi convidado para a equipe! Crie sua conta para começar.
              </AlertDescription>
            </Alert>
          )}

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 rounded-xl gap-3 border-border/60 hover:bg-muted/50 hover:border-border transition-all duration-200 font-medium"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continuar com Google
          </Button>

          {/* Divider */}
          <div className="relative">
            <Separator className="bg-border/40" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground/60 uppercase tracking-widest">
              ou
            </span>
          </div>
          
          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-xl h-11 bg-muted/50 p-1">
              <TabsTrigger value="login" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Entrar</TabsTrigger>
              <TabsTrigger value="register" className="rounded-lg text-sm font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login" className="mt-6">
              <form onSubmit={handleSignIn} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="login-email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="seu@email.com" required />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="login-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</Label>
                    <button type="button" onClick={() => { setForgotEmail(email); setShowForgotPassword(true); }} className="text-xs text-accent hover:text-accent/80 font-medium transition-colors">
                      Esqueci minha senha
                    </button>
                  </div>
                  <Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} placeholder="••••••••" required />
                  {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
                </div>
                
                <Button type="submit" className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all duration-200" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Entrando...</> : 'Entrar'}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="register" className="mt-6">
              <form onSubmit={handleSignUp} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="register-email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
                  <Input id="register-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClasses} placeholder="seu@email.com" required />
                  {errors.email && <p className="text-sm text-destructive mt-1">{errors.email}</p>}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="register-password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</Label>
                  <Input id="register-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClasses} placeholder="Senha forte" required />
                  <p className="text-xs text-muted-foreground/70">Mínimo 8 caracteres, com maiúscula, minúscula e número</p>
                  {errors.password && <p className="text-sm text-destructive mt-1">{errors.password}</p>}
                </div>

                <Alert className="bg-accent/8 border-accent/15 rounded-xl">
                  <AlertDescription className="text-xs text-muted-foreground">
                    Após o cadastro, sua conta precisará ser aprovada por um administrador antes de você poder acessar o sistema.
                  </AlertDescription>
                </Alert>
                
                <Button type="submit" className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-sm tracking-wide shadow-lg shadow-primary/20 transition-all duration-200" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando conta...</> : 'Criar Conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* Footer links */}
          <div className="pt-4 border-t border-border/30 text-center space-y-2">
            <p className="text-xs text-muted-foreground/50">
              Ao continuar, você concorda com nossos termos
            </p>
            <div className="flex justify-center gap-4 text-xs">
              <a href="/politica-privacidade" className="text-muted-foreground/60 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                Política de Privacidade
              </a>
              <span className="text-border">•</span>
              <a href="/termos-servico" className="text-muted-foreground/60 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                Termos de Serviço
              </a>
              <span className="text-border">•</span>
              <a href="/exclusao-de-dados" className="text-muted-foreground/60 hover:text-foreground transition-colors" target="_blank" rel="noopener noreferrer">
                Exclusão de Dados
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={(open) => {
        setShowForgotPassword(open);
        if (!open) { setForgotEmailSent(false); setForgotEmail(''); }
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {forgotEmailSent ? <><CheckCircle className="h-5 w-5 text-success" />Email Enviado</> : <><Mail className="h-5 w-5" />Recuperar Senha</>}
            </DialogTitle>
            <DialogDescription>
              {forgotEmailSent ? 'Verifique sua caixa de entrada para continuar.' : 'Informe seu email para receber um link de redefinição de senha.'}
            </DialogDescription>
          </DialogHeader>

          {forgotEmailSent ? (
            <div className="space-y-4">
              <Alert className="bg-success/10 border-success/20 rounded-xl">
                <CheckCircle className="h-4 w-4 text-success" />
                <AlertDescription>
                  Um email foi enviado para <strong>{forgotEmail}</strong> com instruções para redefinir sua senha.
                </AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">
                Não recebeu o email? Verifique sua pasta de spam ou{' '}
                <button type="button" onClick={() => setForgotEmailSent(false)} className="text-accent hover:underline">tente novamente</button>
              </p>
              <Button onClick={() => setShowForgotPassword(false)} className="w-full h-11 rounded-xl">Voltar ao Login</Button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgot-email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input id="forgot-email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className={inputClasses} placeholder="seu@email.com" required autoFocus />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setShowForgotPassword(false)} className="flex-1 h-11 rounded-xl">
                  <ArrowLeft className="mr-2 h-4 w-4" />Voltar
                </Button>
                <Button type="submit" className="flex-1 h-11 rounded-xl" disabled={sendingResetEmail}>
                  {sendingResetEmail ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : 'Enviar Link'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

