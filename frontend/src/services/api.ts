const API_BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error del servidor");
  return data as T;
}

export interface User {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  dni?: string;
  telefono?: string;
  direccion?: string;
}

export interface LoginResponse {
  user: User;
}

export async function login(email: string, password: string) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(data: Record<string, string>) {
  return request<{ mensaje: string }>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return request<{ mensaje: string }>("/auth/logout", { method: "POST" });
}

export async function getMe() {
  return request<{ user: User }>("/auth/me");
}

export async function forgotPassword(email: string) {
  return request<{ mensaje: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return request<{ mensaje: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export async function verifyEmail(token: string) {
  return request<{ mensaje: string }>(`/auth/verify-email/${token}`);
}

export async function resendVerification(email: string) {
  return request<{ mensaje: string }>("/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function updateProfile(data: Record<string, unknown>) {
  return request<{ mensaje: string; user: User }>("/auth/perfil", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getPacientes() {
  return request<Record<string, unknown>[]>("/pacientes/todos");
}

export async function createPaciente(data: Record<string, string>) {
  return request<{ mensaje: string; id: number }>("/pacientes/crear", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePaciente(id: number, data: Record<string, unknown>) {
  return request<{ mensaje: string }>(`/pacientes/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function buscarPacientes(q: string) {
  return request<Record<string, unknown>[]>(`/pacientes/buscar?q=${encodeURIComponent(q)}`);
}

export async function getCitas(fecha?: string) {
  const params = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  return request<Record<string, unknown>[]>(`/citas${params}`);
}

export async function createCita(data: Record<string, unknown>) {
  return request<{ mensaje: string; id: number }>("/citas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCita(id: number, data: Record<string, unknown>) {
  return request<{ mensaje: string }>(`/citas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCita(id: number) {
  return request<{ mensaje: string }>(`/citas/${id}`, { method: "DELETE" });
}

export async function updateAnalisisEstado(analisisId: number, estado: string) {
  return request<{ mensaje: string }>(`/citas/analisis/${analisisId}/estado`, {
    method: "PUT",
    body: JSON.stringify({ estado }),
  });
}

export async function getResultados(pacienteId?: number) {
  const params = pacienteId ? `?paciente_id=${pacienteId}` : "";
  return request<Record<string, unknown>[]>(`/resultados${params}`);
}

export interface CompartirResponse {
  mensaje: string;
  token: string;
  url: string;
}

export async function compartirResultado(id: number) {
  return request<CompartirResponse>(`/resultados/${id}/compartir`, { method: "POST" });
}

export async function aprobarResultado(id: number) {
  return request<{ mensaje: string }>(`/resultados/${id}/aprobar`, { method: "PUT" });
}

export async function rechazarResultado(id: number) {
  return request<{ mensaje: string }>(`/resultados/${id}/rechazar`, { method: "PUT" });
}

export async function uploadResultado(formData: FormData) {
  const res = await fetch(`${API_BASE}/resultados/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error del servidor");
  return data as { mensaje: string };
}

export async function getUsers() {
  return request<Record<string, unknown>[]>("/users");
}

export async function createUser(data: Record<string, unknown>) {
  return request<{ mensaje: string; id: number }>("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateUser(id: number, data: Record<string, unknown>) {
  return request<{ mensaje: string }>(`/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteUser(id: number) {
  return request<{ mensaje: string }>(`/users/${id}`, { method: "DELETE" });
}

export async function getResenas() {
  return request<Record<string, unknown>[]>("/resenas");
}

export async function getResenasAprobadas() {
  return request<Record<string, unknown>[]>("/resenas/aprobadas");
}

export async function createResena(data: Record<string, unknown>) {
  return request<{ mensaje: string }>("/resenas", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function aprobarResena(id: number, aprobado: boolean) {
  return request<{ mensaje: string }>(`/resenas/${id}/aprobar`, {
    method: "PUT",
    body: JSON.stringify({ aprobado }),
  });
}

export async function updateResena(id: number, data: Record<string, unknown>) {
  return request<{ mensaje: string }>(`/resenas/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}


