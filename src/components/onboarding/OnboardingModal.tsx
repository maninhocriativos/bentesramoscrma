import { useState } from 'react';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePerfil } from '@/hooks/usePerfil';
import { useToast } from '@/hooks/use-toast';
import logo from '@/assets/logo-bentes-ramos.png';

const onboardingSchema = z.object({
  nome: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(50),
  sobrenome: z.string().trim().min(2, 'Sobrenome deve ter pelo menos 2 caracteres').max(50),
  telefone: z.string().trim().min(14, 'Telefone inválido').max(15),
});

function formatPhone(value: string): string {
  // Remove all non-digits
  const digits = value.replace(/\D/g, '');
  
  // Format as (XX) XXXXX-XXXX
  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }
  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function OnboardingModal() {
  const { needsOnboarding, updatePerfil, refetch } = usePerfil();
  const { toast } = useToast();
  
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [oabNumero, setOabNumero] = useState('');
  const [oabUf, setOabUf] = useState('AM');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTelefone(formatPhone(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = onboardingSchema.safeParse({ nome, sobrenome, telefone });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    setErrors({});
    setSaving(true);
    
    const updateData: any = {
      nome: result.data.nome,
      sobrenome: result.data.sobrenome,
      telefone: result.data.telefone,
    };
    if (oabNumero.trim()) {
      updateData.oab_numero = oabNumero.trim();
      updateData.oab_uf = oabUf;
    }
    const { error } = await updatePerfil(updateData);
    
    if (error) {
      toast({
        title: 'Erro ao salvar perfil',
        description: error.message,
        variant: 'destructive',
      });
      setSaving(false);
      return;
    }
    
    toast({
      title: 'Perfil atualizado!',
      description: 'Seja bem-vindo ao sistema.',
    });
    
    await refetch();
    setSaving(false);
  };

  if (!needsOnboarding) return null;

  return (
    <Dialog open={true}>
      <DialogContent 
        className="sm:max-w-md rounded-2xl [&>button]:hidden" 
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img 
              src={logo} 
              alt="Bentes Ramos" 
              className="h-16 w-auto object-contain"
            />
          </div>
          <DialogTitle className="text-2xl">Bem-vindo à Bentes & Ramos!</DialogTitle>
          <DialogDescription>
            Complete seu perfil para começar a usar o sistema.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
              className="rounded-xl"
              autoFocus
            />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="sobrenome">Sobrenome *</Label>
            <Input
              id="sobrenome"
              value={sobrenome}
              onChange={(e) => setSobrenome(e.target.value)}
              placeholder="Seu sobrenome"
              className="rounded-xl"
            />
            {errors.sobrenome && (
              <p className="text-sm text-destructive">{errors.sobrenome}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">WhatsApp *</Label>
            <Input
              id="telefone"
              value={telefone}
              onChange={handlePhoneChange}
              placeholder="(00) 00000-0000"
              className="rounded-xl"
              maxLength={15}
            />
            {errors.telefone && (
              <p className="text-sm text-destructive">{errors.telefone}</p>
            )}
          </div>

          <Button 
            type="submit" 
            className="w-full rounded-xl"
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar e Começar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
