export interface User {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  role: string;
  created_at: string;
}

export interface Paciente {
  id: number;
  user_id: number;
  telefono: string;
  direccion: string;
  fecha_nacimiento: string;
  dni: string;
  created_at: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  nombre: string;
  apellido: string;
  email: string;
  password: string;
  fecha_nacimiento?: string;
  dni?: string;
}

export interface JwtPayload {
  userId: number;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
