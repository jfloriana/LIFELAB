import { useState, useEffect, useMemo } from "react";
import { FlaskConical, Clock, User, Circle, Loader, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { getCitas, updateAnalisisEstado } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const analysisStateColors: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  en_proceso: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  completado: "bg-green-500/20 text-green-600 dark:text-green-400",
};

export default function AnalisisPendientes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [citas, setCitas] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCitas, setExpandedCitas] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedCitas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function load() {
    setLoading(true);
    try {
      const data = await getCitas();
      setCitas(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const citasConPendientes = useMemo(() => {
    const bioName = user ? `${user.nombre} ${user.apellido}` : "";
    return citas.filter((c) => {
      if ((c.medico as string) !== bioName) return false;
      const tests = (c.tests as Record<string, unknown>[]) || (c.analisis_solicitados as Record<string, unknown>[]) || [];
      return tests.some((t) => (t.estado as string) !== "completado");
    });
  }, [citas]);

  const totalPendientes = useMemo(() => {
    let count = 0;
    for (const c of citas) {
      const tests = (c.tests as Record<string, unknown>[]) || (c.analisis_solicitados as Record<string, unknown>[]) || [];
      count += tests.filter((t) => (t.estado as string) !== "completado").length;
    }
    return count;
  }, [citas]);

  async function handleAvanzar(analisisId: number, currentEstado: string) {
    const nextEstado: Record<string, string> = { pendiente: "en_proceso", en_proceso: "completado", completado: "completado" };
    const nuevo = nextEstado[currentEstado];
    if (nuevo === currentEstado) return;
    try {
      await updateAnalisisEstado(analisisId, nuevo);
      toast("Análisis actualizado", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Análisis Pendientes</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
          {totalPendientes} análisis pendiente{totalPendientes !== 1 ? "s" : ""} en {citasConPendientes.length} solicitud{citasConPendientes.length !== 1 ? "es" : ""}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Cargando...</div>
      ) : citasConPendientes.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-white/30 text-sm">No hay análisis pendientes</div>
      ) : (
        <div className="space-y-3">
          {citasConPendientes.map((cita) => {
            const fecha = new Date((cita.fecha as string) + "T12:00:00");
            const citaId = cita.id as number;
            const tests = (cita.tests as Record<string, unknown>[]) || (cita.analisis_solicitados as Record<string, unknown>[]) || [];
            const pendientes = tests.filter((t) => (t.estado as string) !== "completado");

            return (
              <div key={citaId} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {(cita.paciente_nombre as string)?.[0]}{(cita.paciente_apellido as string)?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                        {cita.paciente_nombre as string} {cita.paciente_apellido as string}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/40 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} — {cita.hora_inicio as string}
                        </span>
                        {!!cita.medico && (
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {cita.medico as string}
                          </span>
                        )}
                        {!!cita.idx && <span className="font-mono text-[10px]">IDX: {cita.idx as string}</span>}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {pendientes.map((t) => {
                    const estado = (t.estado as string) || "pendiente";
                    return (
                      <div key={t.id as number} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/[0.02] px-2.5 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${estado === "en_proceso" ? "bg-blue-500" : "bg-yellow-500"}`} />
                          <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                            {(t.test_id as string).replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium ${analysisStateColors[estado] || analysisStateColors.pendiente}`}>
                            {estado === "en_proceso" ? <Loader size={9} /> : <Circle size={9} />}
                            {estado === "en_proceso" ? "Proceso" : "Pendiente"}
                          </span>
                          {estado !== "completado" && (
                          <button
                            onClick={() => handleAvanzar(t.id as number, estado)}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10 transition-all"
                          >
                            {estado === "pendiente" ? "Iniciar" : "Completar"}
                          </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {tests.length > pendientes.length && (
                  <div className="mt-2 border-t border-gray-100 dark:border-white/5 pt-2">
                    <button onClick={() => toggleExpand(citaId)} className="w-full flex items-center justify-between gap-2 text-left">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-1">
                        <FlaskConical size={10} />
                        Todos los análisis
                      </p>
                      <span className="text-gray-400 dark:text-white/30 flex items-center gap-1 text-[10px]">
                        {tests.filter((t) => (t.estado as string) === "completado").length}/{tests.length}
                        {expandedCitas.has(citaId) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>
                    {expandedCitas.has(citaId) && (
                      <div className="mt-1.5 space-y-1">
                        {tests.map((t) => {
                          const st = (t.estado as string) || "pendiente";
                          return (
                            <div key={t.id as number} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/[0.02] px-2.5 py-1.5">
                              <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                                {(t.test_id as string).replace(/_/g, " ")}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-2 ${analysisStateColors[st] || analysisStateColors.pendiente}`}>
                                {st === "completado" ? <CheckCircle size={9} /> : st === "en_proceso" ? <Loader size={9} /> : <Circle size={9} />}
                                {st === "en_proceso" ? "Proceso" : st.charAt(0).toUpperCase() + st.slice(1)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
