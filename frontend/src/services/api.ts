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

export async function aprobarCita(id: number) {
  return request<{ mensaje: string }>(`/citas/${id}/aprobar`, { method: "PUT" });
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

export async function fetchResultadoBlob(id: number): Promise<Blob> {
  const res = await fetch(`${API_BASE}/resultados/download/${id}?accion=previsualizar`, { credentials: "include" });
  if (!res.ok) {
    let msg = "No se pudo cargar el documento";
    try {
      const data = await res.json();
      if (data?.error) msg = data.error;
    } catch { /* non-JSON error body */ }
    throw new Error(msg);
  }
  return res.blob();
}

export const PREVIEW_CONSUMED_MESSAGE =
  "Ya previsualizaste este documento. Vuelve a escanear el código QR para verlo de nuevo.";

/** Error raised when a single-use QR preview ticket was already used or has expired. */
export class PreviewConsumedError extends Error {
  codigo = "PREVIEW_CONSUMED" as const;
  status = 410;
  constructor(message = PREVIEW_CONSUMED_MESSAGE) {
    super(message);
    this.name = "PreviewConsumedError";
  }
}

export const QR_USED_MESSAGE = "Este código ya fue usado. Pide uno nuevo.";

/** Error raised when a shared QR was already consumed (410 QR_USED). */
export class QrUsedError extends Error {
  codigo = "QR_USED" as const;
  status = 410;
  constructor(message = QR_USED_MESSAGE) {
    super(message);
    this.name = "QrUsedError";
  }
}

export type CompartidoInfo = Record<string, unknown> & { ticket?: string; preview_ttl_seconds?: number };

/** Public metadata of a shared result. The first call IS the one and only QR scan: it opens a session ticket. */
export async function getCompartido(token: string): Promise<CompartidoInfo> {
  const res = await fetch(`${API_BASE}/compartido/${encodeURIComponent(token)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 410 && data?.codigo === "QR_USED") throw new QrUsedError(data?.error || QR_USED_MESSAGE);
    throw new Error(data?.error || "Resultado no encontrado");
  }
  return data as CompartidoInfo;
}

/**
 * Consumes the download slot of the scan session and returns the PDF. The ticket goes in a header
 * (never in the URL). Throws QrUsedError on 410.
 */
export async function descargarCompartido(token: string, ticket: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/compartido/${encodeURIComponent(token)}/download`, {
    headers: { "X-Compartido-Ticket": ticket },
  });
  if (!res.ok) {
    let data: { error?: string; codigo?: string } = {};
    try { data = await res.json(); } catch { /* non-JSON error body */ }
    if (res.status === 410) throw new QrUsedError(data.error || QR_USED_MESSAGE);
    throw new Error(data.error || "No se pudo descargar el documento");
  }
  return res.blob();
}

/** Consumes the single-use preview ticket and returns the PDF. Throws PreviewConsumedError on 410. */
export async function previsualizarCompartido(token: string, ticket: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}/compartido/${encodeURIComponent(token)}/previsualizar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticket }),
  });
  if (!res.ok) {
    let data: { error?: string; codigo?: string } = {};
    try { data = await res.json(); } catch { /* non-JSON error body */ }
    if (res.status === 410 || data.codigo === "PREVIEW_CONSUMED") throw new PreviewConsumedError();
    throw new Error(data.error || "No se pudo cargar el documento");
  }
  return res.blob();
}

export interface CompartirResponse {
  mensaje?: string;
  token: string;
  url: string;
  generados: number;
  restantes: number;
  limite: number;
  ventana_horas: number;
}

/** Error raised when the QR generation limit of a resultado was reached (429 QR_LIMIT). */
export class QrLimitError extends Error {
  codigo = "QR_LIMIT" as const;
  status = 429;
  reintentoEnSegundos: number;
  constructor(message: string, reintentoEnSegundos: number) {
    super(message);
    this.name = "QrLimitError";
    this.reintentoEnSegundos = reintentoEnSegundos;
  }
}

export async function compartirResultado(id: number): Promise<CompartirResponse> {
  const res = await fetch(`${API_BASE}/resultados/${id}/compartir`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429 && data?.codigo === "QR_LIMIT") {
    throw new QrLimitError(data.error || "Alcanzaste el límite de códigos QR.", Number(data.reintento_en_segundos) || 60);
  }
  if (!res.ok) throw new Error(data?.error || "Error del servidor");
  return data as CompartirResponse;
}

export interface QrEstado {
  activo: boolean;
  generados: number;
  restantes: number;
  limite: number;
  bloqueado: boolean;
  reintento_en_segundos: number | null;
}

export async function getQrEstado(id: number) {
  return request<QrEstado>(`/resultados/${id}/compartir/estado`);
}

export async function desbloquearQr(id: number) {
  return request<{ ok: true }>(`/resultados/${id}/qr/desbloquear`, { method: "POST" });
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



export type AccesoAccion =
  | "previsualizar"
  | "descarga"
  | "compartir"
  | "descarga_compartida"
  | "previsualizacion_compartida"
  | "qr_bloqueado"
  | "desbloqueo_qr";

export interface QrBloqueado {
  resultado_id: number;
  titulo: string | null;
  paciente_nombre: string | null;
  paciente_apellido: string | null;
  generados: number;
  reintento_en_segundos: number;
}

export interface AccesoItem {
  id: number;
  resultado_id: number;
  accion: AccesoAccion;
  role: string | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
  usuario: { nombre: string; apellido: string; email: string } | null;
  resultado: { titulo: string; paciente_nombre: string | null; paciente_apellido: string | null } | null;
}

export interface AccesosPage {
  items: AccesoItem[];
  total: number;
  page: number;
  limit: number;
}

export interface AccesosResumen {
  ultimos_7_dias: Record<AccesoAccion, number>;
  ultimos_30_dias: Record<AccesoAccion, number>;
  total_30_dias: number;
  usuarios_unicos_30_dias: number;
  mas_consultados: {
    resultado_id: number;
    titulo: string | null;
    paciente_nombre: string | null;
    paciente_apellido: string | null;
    total: number;
  }[];
}

export async function getAccesos(params: {
  accion?: string;
  q?: string;
  desde?: string;
  hasta?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const suffix = qs.toString();
  return request<AccesosPage>(`/accesos${suffix ? `?${suffix}` : ""}`);
}

export async function getAccesosResumen() {
  return request<AccesosResumen>("/accesos/resumen");
}

export async function getQrBloqueados() {
  return request<QrBloqueado[]>("/accesos/qr-bloqueados");
}
