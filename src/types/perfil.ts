export type UserCargo = 'Administrador' | 'Advogado' | 'Secretaria';

export interface Perfil {
  id: string;
  email: string | null;
  nome: string | null;
  cargo: UserCargo | null;
}
