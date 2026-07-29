import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, User, FlaskConical, CheckCircle, Circle, Loader, ChevronDown, ChevronUp } from "lucide-react";
import { getCitas, updateAnalisisEstado, aprobarCita } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

const MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(str: string) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const analysisStateColors: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  en_proceso: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  completado: "bg-green-500/20 text-green-600 dark:text-green-400",
};

const citaStateColors: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  aprobada: "bg-green-500/20 text-green-600 dark:text-green-400",
  en_proceso: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  completada: "bg-green-500/20 text-green-600 dark:text-green-400",
  cancelada: "bg-red-500/20 text-red-600 dark:text-red-400",
};

const nextEstado: Record<string, string> = {
  pendiente: "en_proceso",
  en_proceso: "completado",
  completado: "completado",
};

export default function Citas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allCitas, setAllCitas] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));

  const isBioanalista = user?.role === "bioanalista";
  const isPaciente = user?.role === "paciente";
  const [expandedCitas, setExpandedCitas] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedCitas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const bioanalistaName = useMemo(() => {
    if (isBioanalista && user) return `${user.nombre} ${user.apellido}`;
    return null;
  }, [isBioanalista, user]);

  async function load() {
    setLoading(true);
    try {
      const data = await getCitas();
      setAllCitas(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const citasByDate = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    if (!Array.isArray(allCitas)) return map;
    for (const c of allCitas) {
      if (isBioanalista && bioanalistaName && (c.medico as string) !== bioanalistaName) continue;
      const f = c.fecha as string;
      if (!map[f]) map[f] = [];
      map[f].push(c);
    }
    return map;
  }, [allCitas, isBioanalista, bioanalistaName]);

  const monthCitas = useMemo(() => {
    const monthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const result: Record<string, Record<string, unknown>[]> = {};
    for (const [fecha, citas] of Object.entries(citasByDate)) {
      if (fecha.startsWith(monthStr)) result[fecha] = citas;
    }
    return result;
  }, [citasByDate, currentMonth, currentYear]);

  const dayCitas = useMemo(() => {
    return citasByDate[selectedDate] || [];
  }, [citasByDate, selectedDate]);

  async function handleAvanzarAnalisis(analisisId: number, currentEstado: string) {
    const nuevo = nextEstado[currentEstado];
    if (nuevo === currentEstado) return;
    try {
      await updateAnalisisEstado(analisisId, nuevo);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleAprobarCita(citaId: number) {
    try {
      await aprobarCita(citaId);
      toast("Cita aprobada exitosamente", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  function prevMonth() {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
    else setCurrentMonth(m => m - 1);
  }

  function nextMonth() {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
    else setCurrentMonth(m => m + 1);
  }

  function goToday() {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
    setSelectedDate(formatDate(now));
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
  const todayStr = formatDate(new Date());

  const calendarCells = [];
  for (let i = 0; i < firstDay; i++) {
    calendarCells.push(<div key={`e-${i}`} className="border-r border-b border-gray-100 dark:border-white/5 min-h-[100px] bg-gray-50/30 dark:bg-white/[0.01]" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = dateStr === todayStr;
    const isSelected = dateStr === selectedDate;
    const dayCits = monthCitas[dateStr] || [];

    calendarCells.push(
      <button
        key={d}
        onClick={() => setSelectedDate(dateStr)}
        className={`border-r border-b border-gray-100 dark:border-white/5 min-h-[100px] p-1.5 overflow-hidden text-left w-full transition-colors ${
          isSelected
            ? "ring-2 ring-inset ring-cyan-500 bg-cyan-50/30 dark:bg-cyan-500/10"
            : isToday
              ? "bg-cyan-50/50 dark:bg-cyan-500/5"
              : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
        }`}
      >
        <div className={`text-xs font-semibold mb-1 px-1.5 py-0.5 rounded-full w-fit ${
          isToday && !isSelected ? "bg-cyan-500 text-white" : isSelected ? "bg-cyan-500 text-white" : "text-gray-500 dark:text-white/40"
        }`}>
          {d}
        </div>
        <div className="space-y-0.5 pointer-events-none">
          {dayCits.slice(0, 3).map((c) => (
            <div
              key={c.id as number}
              className={`text-[10px] px-1.5 py-0.5 rounded truncate font-medium ${
                (c.estado as string) === "completada"
                  ? "bg-green-500/20 text-green-700 dark:text-green-300"
                  : (c.estado as string) === "cancelada"
                    ? "bg-red-500/20 text-red-700 dark:text-red-300"
                    : (c.estado as string) === "en_proceso"
                      ? "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      : (c.estado as string) === "aprobada"
                        ? "bg-green-500/15 text-green-700 dark:text-green-300"
                        : "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300"
              }`}
            >
              <span className="font-mono">{c.hora_inicio as string}</span>{" "}
              {c.paciente_nombre as string} {((c.paciente_apellido as string) || "")[0]}.
            </div>
          ))}
          {dayCits.length > 3 && (
            <span className="text-[10px] text-gray-400 dark:text-white/30 pl-1.5">
              +{dayCits.length - 3} más
            </span>
          )}
        </div>
      </button>
    );
  }

  const dateDisplay = useMemo(() => {
    const d = parseDate(selectedDate);
    return d.toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  }, [selectedDate]);

  const pendingAnalyses = useMemo(() => {
    const result: { cita: Record<string, unknown>; analisis: Record<string, unknown> }[] = [];
    for (const c of allCitas) {
      if (isBioanalista && bioanalistaName && (c.medico as string) !== bioanalistaName) continue;
      const tests = (c.tests as Record<string, unknown>[]) || [];
      for (const t of tests) {
        if ((t.estado as string) !== "completado") {
          result.push({ cita: c, analisis: t });
        }
      }
    }
    return result;
  }, [allCitas, isBioanalista, bioanalistaName]);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Calendario</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">
          {isBioanalista ? "Tus citas asignadas" : isPaciente ? "Tus citas" : "Vista de calendario del laboratorio"}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Cargando...</div>
      ) : (
        <>
          {/* Calendar */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-white/5">
              <div className="flex items-center gap-2">
                <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-white/60 transition-colors">
                  <ChevronLeft size={20} />
                </button>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white min-w-[200px] text-center">
                  {MONTHS[currentMonth]} {currentYear}
                </h2>
                <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-white/60 transition-colors">
                  <ChevronRight size={20} />
                </button>
              </div>
              <button onClick={goToday} className="text-sm font-medium text-cyan-600 dark:text-cyan-400 hover:underline">
                Hoy
              </button>
            </div>

            <div className="grid grid-cols-7 border-t border-gray-100 dark:border-white/5">
              {WEEKDAYS.map((d) => (
                <div key={d} className="text-center text-[11px] font-bold text-gray-400 dark:text-white/50 uppercase tracking-wider py-2 border-b border-gray-100 dark:border-white/5">
                  {d.slice(0, 3)}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarCells}
            </div>
          </div>

          {/* Citas del día */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/[0.02]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white capitalize">{dateDisplay}</h3>
              <span className="text-xs text-gray-400 dark:text-white/30">{dayCitas.length} cita{dayCitas.length !== 1 ? "s" : ""}</span>
            </div>

            {dayCitas.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 dark:text-white/40 text-sm">No hay citas para esta fecha</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {dayCitas.map((c) => {
                  const estado = (c.estado as string) || "pendiente";
                  const tests = (c.tests as Record<string, unknown>[]) || [];
                  return (
                    <div key={c.id as number} className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                            {(c.paciente_nombre as string)?.[0]}{(c.paciente_apellido as string)?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {c.paciente_nombre as string} {c.paciente_apellido as string}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/40 mt-0.5">
                              <span className="flex items-center gap-1">
                                <Clock size={10} />
                                {c.hora_inicio as string} - {c.hora_fin as string}
                              </span>
                              {!!c.idx && <span className="font-mono">IDX: {c.idx as string}</span>}
                            </div>
                          </div>
                        </div>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${citaStateColors[estado] || citaStateColors.pendiente}`}>
                            {estado === "en_proceso" ? "En Proceso" : estado.charAt(0).toUpperCase() + estado.slice(1)}
                          </span>
                          {(user?.role === "admin" || user?.role === "recepcionista") && estado === "pendiente" && (
                            <button
                              onClick={() => handleAprobarCita(c.id as number)}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-medium text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10 transition-all ml-1"
                            >
                              Aprobar
                            </button>
                          )}
                      </div>

                      {!!c.medico && (
                        <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-white/40 mb-2 ml-12">
                          <User size={10} />
                          {c.medico as string}
                        </div>
                      )}

                      {tests.length > 0 && (
                        <div className="border-t border-gray-100 dark:border-white/5 pt-2 mt-2">
                          <button onClick={() => toggleExpand(c.id as number)} className="w-full flex items-center justify-between gap-2 text-left">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-1">
                              <FlaskConical size={10} />
                              Análisis ({tests.filter(t => (t.estado as string) === "completado").length}/{tests.length})
                            </p>
                            <span className="text-gray-400 dark:text-white/30">
                              {expandedCitas.has(c.id as number) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </span>
                          </button>
                          {expandedCitas.has(c.id as number) && (
                            <div className="mt-1.5 space-y-1">
                              {tests.map((t) => {
                                const testEstado = (t.estado as string) || "pendiente";
                                return (
                                  <div key={t.id as number} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 dark:bg-white/[0.02] px-2.5 py-1.5">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FlaskConical size={10} className="text-gray-400 shrink-0" />
                                      <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                                        {(t.test_id as string).replace(/_/g, " ")}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium ${analysisStateColors[testEstado] || analysisStateColors.pendiente}`}>
                                        {testEstado === "en_proceso" ? "Proceso" : testEstado.charAt(0).toUpperCase() + testEstado.slice(1)}
                                      </span>
                                      {user?.role === "admin" && testEstado !== "completado" && (
                                        <button
                                          onClick={() => handleAvanzarAnalisis(t.id as number, testEstado)}
                                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-white/10 text-gray-400 hover:text-cyan-500 transition-colors"
                                          title={`Avanzar a ${nextEstado[testEstado] === "completado" ? "Completado" : "En Proceso"}`}
                                        >
                                          {testEstado === "pendiente" ? <Circle size={12} /> : <Loader size={12} />}
                                        </button>
                                      )}
                                      {testEstado === "completado" && <CheckCircle size={12} className="text-green-500" />}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {!!c.notas && (
                        <p className="text-[11px] text-gray-400 dark:text-white/30 mt-2 italic">{c.notas as string}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
