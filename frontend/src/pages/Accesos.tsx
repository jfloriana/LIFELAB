import { useCallback, useEffect, useState } from "react";
import { Eye, Download, Share2, Users, Activity, ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { getAccesos, getAccesosResumen, getQrBloqueados, desbloquearQr, type AccesoItem, type AccesosResumen, type QrBloqueado } from "@/services/api";

const PAGE_SIZE = 25;

const accionLabels: Record<string, string> = {
  previsualizar: "Previsualización",
  descarga: "Descarga",
  compartir: "Enlace compartido",
  descarga_compartida: "Descarga por enlace",
  previsualizacion_compartida: "Previsualización por QR",
  qr_bloqueado: "QR bloqueado",
  desbloqueo_qr: "QR desbloqueado",
};

const accionColors: Record<string, string> = {
  previsualizar: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  descarga: "bg-green-500/20 text-green-600 dark:text-green-400",
  compartir: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  descarga_compartida: "bg-orange-500/20 text-orange-600 dark:text-orange-400",
  previsualizacion_compartida: "bg-teal-500/20 text-teal-600 dark:text-teal-400",
  qr_bloqueado: "bg-red-500/20 text-red-600 dark:text-red-400",
  desbloqueo_qr: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  bioanalista: "Bioanalista",
  recepcionista: "Recepcionista",
  paciente: "Paciente",
};

const roleColors: Record<string, string> = {
  admin: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  bioanalista: "bg-green-500/20 text-green-600 dark:text-green-400",
  recepcionista: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  paciente: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
};

const neutralBadge = "bg-gray-500/20 text-gray-600 dark:text-white/50";
const badgeBase = "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fullName(nombre?: string | null, apellido?: string | null): string {
  return [nombre, apellido].filter(Boolean).join(" ");
}

function AccionBadge({ accion }: { accion: string }) {
  return <span className={`${badgeBase} ${accionColors[accion] ?? neutralBadge}`}>{accionLabels[accion] ?? accion}</span>;
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role) return null;
  return <span className={`${badgeBase} ${roleColors[role] ?? neutralBadge}`}>{roleLabels[role] ?? role}</span>;
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Eye; label: string; value: number | null; tone: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/5 dark:bg-white/[0.02] flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tone}`}>
        <Icon size={18} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 dark:text-white/40 truncate">{label}</p>
        {value === null ? (
          <div className="mt-1 h-6 w-12 rounded bg-gray-200 dark:bg-white/10 animate-pulse" aria-hidden="true" />
        ) : (
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value.toLocaleString("es-PE")}</p>
        )}
      </div>
    </div>
  );
}

function minutesLabel(seconds: number): string {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `${m} ${m === 1 ? "minuto" : "minutos"}`;
}

export default function Accesos() {
  const [resumen, setResumen] = useState<AccesosResumen | null>(null);
  const [resumenError, setResumenError] = useState(false);

  const [accion, setAccion] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<AccesoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounce the text search so each keystroke does not hit the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setQ(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const loadResumen = useCallback(async () => {
    setResumenError(false);
    try {
      setResumen(await getAccesosResumen());
    } catch {
      setResumenError(true);
    }
  }, []);

  useEffect(() => { loadResumen(); }, [loadResumen]);

  const rangeInvalid = desde !== "" && hasta !== "" && desde > hasta;

  const load = useCallback(async () => {
    if (rangeInvalid) {
      setItems([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await getAccesos({ accion, q, desde, hasta, page, limit: PAGE_SIZE });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el registro");
    }
    setLoading(false);
  }, [accion, q, desde, hasta, page, rangeInvalid]);

  useEffect(() => { load(); }, [load]);

  // Blocked QR panel: the countdown is derived from the moment the list was fetched.
  const [bloqueados, setBloqueados] = useState<QrBloqueado[]>([]);
  const [bloqueadosAt, setBloqueadosAt] = useState(() => Date.now());
  const [tick, setTick] = useState(() => Date.now());
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [unlockError, setUnlockError] = useState("");

  const loadBloqueados = useCallback(async () => {
    try {
      const list = await getQrBloqueados();
      setBloqueados(list);
      setBloqueadosAt(Date.now());
      setTick(Date.now());
    } catch {
      // The panel is optional: a failure just leaves it hidden or stale.
    }
  }, []);

  useEffect(() => { loadBloqueados(); }, [loadBloqueados]);

  useEffect(() => {
    if (bloqueados.length === 0) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [bloqueados.length]);

  async function unlock(resultadoId: number) {
    setUnlocking(resultadoId);
    setUnlockError("");
    try {
      await desbloquearQr(resultadoId);
      setConfirmId(null);
      await Promise.all([loadBloqueados(), loadResumen(), load()]);
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : "No se pudo desbloquear");
    }
    setUnlocking(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  function changeFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Accesos</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
          Registro de quién previsualizó, descargó o compartió resultados
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={Activity} label="Accesos (30 días)" value={resumen ? resumen.total_30_dias : null} tone="bg-cyan-500/15 text-cyan-600 dark:text-cyan-400" />
        <SummaryCard icon={Eye} label="Previsualizaciones" value={resumen ? resumen.ultimos_30_dias.previsualizar + resumen.ultimos_30_dias.previsualizacion_compartida : null} tone="bg-blue-500/15 text-blue-600 dark:text-blue-400" />
        <SummaryCard icon={Download} label="Descargas" value={resumen ? resumen.ultimos_30_dias.descarga + resumen.ultimos_30_dias.descarga_compartida : null} tone="bg-green-500/15 text-green-600 dark:text-green-400" />
        <SummaryCard icon={Users} label="Usuarios únicos" value={resumen ? resumen.usuarios_unicos_30_dias : null} tone="bg-purple-500/15 text-purple-600 dark:text-purple-400" />
      </div>
      {resumenError && (
        <p role="alert" className="text-sm text-red-500 flex items-center gap-2">
          No se pudo cargar el resumen.
          <button type="button" onClick={loadResumen} className="underline">Reintentar</button>
        </p>
      )}

      {resumen && resumen.mas_consultados.length > 0 && (
        <section aria-labelledby="mas-consultados" className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/5 dark:bg-white/[0.02]">
          <h2 id="mas-consultados" className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Más consultados (30 días)</h2>
          <ol className="space-y-2">
            {resumen.mas_consultados.map((r, i) => (
              <li key={r.resultado_id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-xs text-gray-400 shrink-0">{i + 1}.</span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 dark:text-white truncate">{r.titulo || `Resultado #${r.resultado_id}`}</p>
                  <p className="text-xs text-gray-500 dark:text-white/40 truncate">{fullName(r.paciente_nombre, r.paciente_apellido) || "Paciente no disponible"}</p>
                </div>
                <span className={`${badgeBase} bg-cyan-500/15 text-cyan-600 dark:text-cyan-400`}>{r.total}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {bloqueados.length > 0 && (
        <section aria-labelledby="qr-bloqueados" className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-500/20 dark:bg-red-500/10">
          <h2 id="qr-bloqueados" className="text-sm font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
            <Lock size={16} aria-hidden="true" /> QR bloqueados
          </h2>
          {unlockError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-2">{unlockError}</p>}
          <ul className="space-y-2">
            {bloqueados.map((b) => {
              const remaining = Math.max(0, b.reintento_en_segundos - Math.floor((tick - bloqueadosAt) / 1000));
              return (
                <li key={b.resultado_id} className="flex items-center gap-3 flex-wrap text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="text-gray-900 dark:text-white truncate">{b.titulo || `Resultado #${b.resultado_id}`}</p>
                    <p className="text-xs text-gray-500 dark:text-white/40">
                      {fullName(b.paciente_nombre, b.paciente_apellido) || "Paciente no disponible"} · {b.generados} códigos generados · se libera en {remaining > 0 ? minutesLabel(remaining) : "unos segundos"}
                    </p>
                  </div>
                  {confirmId === b.resultado_id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-600 dark:text-white/60">¿Desbloquear este resultado?</span>
                      <Button size="sm" onClick={() => unlock(b.resultado_id)} disabled={unlocking === b.resultado_id}>
                        {unlocking === b.resultado_id ? "Desbloqueando..." : "Sí, desbloquear"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setConfirmId(null)} disabled={unlocking === b.resultado_id}>Cancelar</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => { setUnlockError(""); setConfirmId(b.resultado_id); }}>
                      <Unlock size={14} className="mr-1" /> Desbloquear
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label htmlFor="acc-accion" className="block text-sm text-gray-500 dark:text-white/40 mb-1">Acción</label>
          <Select id="acc-accion" value={accion} onChange={(e) => changeFilter(setAccion, e.target.value)}>
            <option value="">Todas</option>
            {Object.entries(accionLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </div>
        <div>
          <label htmlFor="acc-buscar" className="block text-sm text-gray-500 dark:text-white/40 mb-1">Buscar</label>
          <Input id="acc-buscar" type="search" maxLength={100} placeholder="Usuario, correo o resultado" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <label htmlFor="acc-desde" className="block text-sm text-gray-500 dark:text-white/40 mb-1">Desde</label>
          <Input id="acc-desde" type="date" value={desde} onChange={(e) => changeFilter(setDesde, e.target.value)} />
        </div>
        <div>
          <label htmlFor="acc-hasta" className="block text-sm text-gray-500 dark:text-white/40 mb-1">Hasta</label>
          <Input id="acc-hasta" type="date" value={hasta} onChange={(e) => changeFilter(setHasta, e.target.value)} />
        </div>
      </div>
      {rangeInvalid && (
        <p role="alert" className="text-sm text-red-500">La fecha "Desde" no puede ser posterior a "Hasta".</p>
      )}

      {error ? (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-6 text-center dark:border-red-500/20 dark:bg-red-500/10">
          <AlertTriangle className="mx-auto mb-2 text-red-500" size={24} aria-hidden="true" />
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
          <Button onClick={load}><RefreshCw size={16} className="mr-2" /> Reintentar</Button>
        </div>
      ) : loading ? (
        <div className="space-y-2" aria-busy="true" aria-live="polite">
          <span className="sr-only">Cargando registros</span>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-gray-200 dark:bg-white/[0.06] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Sin registros</div>
      ) : (
        <>
          {/* Wide screens: table */}
          <div className="hidden md:block rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/[0.02] overflow-hidden">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-white/40 border-b border-gray-200 dark:border-white/5">
                  <th scope="col" className="px-4 py-3 font-medium w-[15%]">Fecha y hora</th>
                  <th scope="col" className="px-4 py-3 font-medium w-[27%]">Usuario</th>
                  <th scope="col" className="px-4 py-3 font-medium w-[16%]">Acción</th>
                  <th scope="col" className="px-4 py-3 font-medium w-[30%]">Resultado</th>
                  <th scope="col" className="px-4 py-3 font-medium w-[12%]">IP</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-gray-100 last:border-0 dark:border-white/5 align-top">
                    <td className="px-4 py-3 text-gray-700 dark:text-white/70">{formatDateTime(it.created_at)}</td>
                    <td className="px-4 py-3 min-w-0">
                      <p className="text-gray-900 dark:text-white truncate">{it.usuario ? fullName(it.usuario.nombre, it.usuario.apellido) : "Usuario eliminado"}</p>
                      {it.usuario && <p className="text-xs text-gray-500 dark:text-white/40 truncate">{it.usuario.email}</p>}
                      <div className="mt-1"><RoleBadge role={it.role} /></div>
                    </td>
                    <td className="px-4 py-3"><AccionBadge accion={it.accion} /></td>
                    <td className="px-4 py-3 min-w-0">
                      <p className="text-gray-900 dark:text-white truncate">{it.resultado?.titulo || `Resultado #${it.resultado_id}`}</p>
                      {it.resultado && <p className="text-xs text-gray-500 dark:text-white/40 truncate">{fullName(it.resultado.paciente_nombre, it.resultado.paciente_apellido)}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-white/40 break-all">{it.ip || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Narrow screens: stacked cards */}
          <ul className="md:hidden space-y-3">
            {items.map((it) => (
              <li key={it.id} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/5 dark:bg-white/[0.02] space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <AccionBadge accion={it.accion} />
                  <span className="text-xs text-gray-500 dark:text-white/40">{formatDateTime(it.created_at)}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{it.usuario ? fullName(it.usuario.nombre, it.usuario.apellido) : "Usuario eliminado"}</p>
                  {it.usuario && <p className="text-xs text-gray-500 dark:text-white/40 truncate">{it.usuario.email}</p>}
                </div>
                <RoleBadge role={it.role} />
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white truncate">{it.resultado?.titulo || `Resultado #${it.resultado_id}`}</p>
                  {it.resultado && <p className="text-xs text-gray-500 dark:text-white/40 truncate">{fullName(it.resultado.paciente_nombre, it.resultado.paciente_apellido)}</p>}
                </div>
                <p className="text-xs text-gray-500 dark:text-white/40 flex items-center gap-1"><Share2 size={12} aria-hidden="true" /> IP: {it.ip || "—"}</p>
              </li>
            ))}
          </ul>

          <nav aria-label="Paginación" className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-gray-500 dark:text-white/40" aria-live="polite">
              Mostrando {from}–{to} de {total.toLocaleString("es-PE")}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Página anterior">
                <ChevronLeft size={16} className="mr-1" /> Anterior
              </Button>
              <span className="text-xs text-gray-500 dark:text-white/40">{page} / {totalPages}</span>
              <Button variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} aria-label="Página siguiente">
                Siguiente <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
