export type UserCargo = 'Administrador' | 'Advogado' | 'Secretaria' | 'Atendente';

export interface Perfil {
  id: string;
  email: string | null;
  nome: string | null;
  cargo: UserCargo | null;
}
