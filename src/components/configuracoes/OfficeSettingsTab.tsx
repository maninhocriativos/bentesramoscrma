import { useState, useRef } from 'react';
import { useOfficeSettings } from '@/hooks/useOfficeSettings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Building2, Upload, Save, User, Phone, MapPin, Mail, Scale, Loader2 } from 'lucide-react';

export function OfficeSettingsTab() {
  const { settings, loading, updateSettings, uploadLogo } = useOfficeSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [formData, setFormData] = useState({
    office_name: '',
    logo_url: '',
    lawyer_name: '',
    oab_number: '',
    oab_state: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zip_code: '',
    website: '',
  });

  // Sync form data when settings load
  useState(() => {
    if (settings) {
      setFormData({
        office_name: settings.office_name || '',
        logo_url: settings.logo_url || '',
        lawyer_name: settings.lawyer_name || '',
        oab_number: settings.oab_number || '',
        oab_state: settings.oab_state || '',
        phone: settings.phone || '',
        email: settings.email || '',
        address: settings.address || '',
        city: settings.city || '',
        state: settings.state || '',
        zip_code: settings.zip_code || '',
        website: settings.website || '',
      });
    }
  });

  // Update form when settings change
  if (settings && formData.office_name === '' && settings.office_name) {
    setFormData({
      office_name: settings.office_name || '',
      logo_url: settings.logo_url || '',
      lawyer_name: settings.lawyer_name || '',
      oab_number: settings.oab_number || '',
      oab_state: settings.oab_state || '',
      phone: settings.phone || '',
      email: settings.email || '',
      address: settings.address || '',
      city: settings.city || '',
      state: settings.state || '',
      zip_code: settings.zip_code || '',
      website: settings.website || '',
    });
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const url = await uploadLogo(file);
    if (url) {
      setFormData(prev => ({ ...prev, logo_url: url }));
    }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await updateSettings(formData);
    setSaving(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Logo e Nome do Escritório */}
      <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground">
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Identidade do Escritório
          </CardTitle>
          <CardDescription className="text-primary-foreground/70">
            Logo e nome que aparecem nas petições e documentos
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Logo Upload */}
            <div className="flex flex-col items-center gap-3">
              <Avatar className="h-32 w-32 rounded-xl border-2 border-dashed border-primary/30">
                <AvatarImage src={formData.logo_url} alt="Logo" className="object-contain p-2" />
                <AvatarFallback className="rounded-xl bg-primary/5">
                  <Building2 className="h-12 w-12 text-primary/40" />
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                {uploading ? 'Enviando...' : 'Upload Logo'}
              </Button>
            </div>

            {/* Nome do Escritório */}
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="office_name">Nome do Escritório</Label>
                <Input
                  id="office_name"
                  value={formData.office_name}
                  onChange={e => handleChange('office_name', e.target.value)}
                  placeholder="Ex: Bentes & Ramos Advocacia"
                  className="text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={e => handleChange('website', e.target.value)}
                  placeholder="https://www.escritorio.com.br"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Advogado */}
      <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-gold/20 to-gold/5 border-b border-gold/20">
          <CardTitle className="text-lg flex items-center gap-2">
            <Scale className="h-5 w-5 text-gold" />
            Dados do Advogado Responsável
          </CardTitle>
          <CardDescription>
            Informações que aparecem na assinatura das petições
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lawyer_name" className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                Nome Completo
              </Label>
              <Input
                id="lawyer_name"
                value={formData.lawyer_name}
                onChange={e => handleChange('lawyer_name', e.target.value)}
                placeholder="Dr. João da Silva"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="oab_number">Número OAB</Label>
                <Input
                  id="oab_number"
                  value={formData.oab_number}
                  onChange={e => handleChange('oab_number', e.target.value)}
                  placeholder="12345"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oab_state">UF</Label>
                <Input
                  id="oab_state"
                  value={formData.oab_state}
                  onChange={e => handleChange('oab_state', e.target.value.toUpperCase())}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                E-mail Profissional
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={e => handleChange('email', e.target.value)}
                placeholder="contato@escritorio.com.br"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                Telefone
              </Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={e => handleChange('phone', e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card className="rounded-xl shadow-enterprise border-0 overflow-hidden">
        <CardHeader className="bg-muted/50 border-b">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5 text-muted-foreground" />
            Endereço do Escritório
          </CardTitle>
          <CardDescription>
            Endereço para contato e correspondências
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="address">Endereço Completo</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={e => handleChange('address', e.target.value)}
                placeholder="Rua das Flores, 123, Sala 456, Edifício Empresarial"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={e => handleChange('city', e.target.value)}
                  placeholder="São Paulo"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={e => handleChange('state', e.target.value.toUpperCase())}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={e => handleChange('zip_code', e.target.value)}
                  placeholder="01234-567"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          size="lg"
          className="gap-2 rounded-xl shadow-soft"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
