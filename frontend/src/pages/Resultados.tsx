import { useState, useEffect, useRef } from "react";
import { Upload, Clock, User, FlaskConical, CheckCircle2, Circle, Loader, Download, QrCode, ChevronDown, ChevronUp, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getCitas, getResultados, aprobarResultado, rechazarResultado, uploadResultado } from "@/services/api";
import { QRModal } from "@/components/qr-modal";
import { useToast } from "@/components/ui/use-toast";

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  aprobado: "bg-green-500/20 text-green-600 dark:text-green-400",
  rechazado: "bg-red-500/20 text-red-600 dark:text-red-400",
};

export default function Resultados() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [citas, setCitas] = useState<Record<string, unknown>[]>([]);
  const [resultados, setResultados] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrId, setQrId] = useState<number | null>(null);
  const [expandedCitas, setExpandedCitas] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedCitas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Upload form state
  const [selectedPacienteId, setSelectedPacienteId] = useState<number | null>(null);
  const [selectedCitaId, setSelectedCitaId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);


  const formRef = useRef<HTMLFormElement>(null);

  // Tab for recepcionista
  const [tab, setTab] = useState<"pending" | "approved">("pending");

  const role = user?.role || "";
  const isBioanalista = role === "bioanalista";
  const isRecepcionista = role === "recepcionista";
  const isPaciente = role === "paciente";
  const canApprove = role === "recepcionista" || role === "admin";

  async function load() {
    setLoading(true);
    try {
      const [citasData, resData] = await Promise.all([
        getCitas(),
        getResultados(),
      ]);
      const arr = Array.isArray(citasData) ? citasData : [];
      arr.sort((a, b) => {
        const da = (a.fecha as string) + " " + (a.hora_inicio as string);
        const db = (b.fecha as string) + " " + (b.hora_inicio as string);
        return db.localeCompare(da);
      });
      setCitas(arr);
      setResultados(Array.isArray(resData) ? resData : []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAprobar(id: number) {
    try {
      await aprobarResultado(id);
      toast("Resultado aprobado", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  async function handleRechazar(id: number) {
    try {
      await rechazarResultado(id);
      toast("Resultado rechazado", "success");
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
  }

  // Bioanalista: only upload form
  if (isBioanalista) {
    const citasConResultado = new Set(resultados.filter(r => r.estado === "aprobado").map((r) => r.cita_id as number));
    const bioName = user ? `${user.nombre} ${user.apellido}` : "";
    const pacientesList = [...new Map(
      citas
        .filter((c) => (c.medico as string) === bioName && ["aprobada", "en_proceso"].includes(c.estado as string))
        .map((c) => [c.paciente_id as number, { id: c.paciente_id as number, nombre: c.paciente_nombre as string, apellido: c.paciente_apellido as string }])
    ).values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
    const citasPaciente = selectedPacienteId
      ? citas.filter((c) =>
          (c.paciente_id as number) === selectedPacienteId &&
          !citasConResultado.has(c.id as number) &&
          (c.medico as string) === bioName &&
          ["aprobada", "en_proceso"].includes(c.estado as string)
        )
      : [];

    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subir Resultado</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Los resultados subidos quedan pendientes de aprobación</p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
          <form ref={formRef} onSubmit={async (e) => {
            e.preventDefault();
            if (!formRef.current) return;
            setUploading(true);
            try {
              const fd = new FormData(formRef.current);
              await uploadResultado(fd);
              toast("Resultado enviado exitosamente", "success");
              formRef.current.reset();
              setSelectedPacienteId(null);
              setSelectedCitaId(null);
              load();
            } catch (err) {
              toast(err instanceof Error ? err.message : "Error al subir");
            }
            setUploading(false);
          }} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Paciente</label>
              <Select value={selectedPacienteId ? String(selectedPacienteId) : ""} onChange={(e) => { setSelectedPacienteId(e.target.value ? Number(e.target.value) : null); setSelectedCitaId(null); }}>
                <option value="">Seleccionar paciente...</option>
                {pacientesList.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre} {p.apellido}</option>
                ))}
              </Select>
            </div>
            <input type="hidden" name="paciente_id" value={selectedPacienteId || ""} />

            {citasPaciente.length > 0 && (
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Ficha de solicitud (IDX)</label>
                <Select value={selectedCitaId ? String(selectedCitaId) : ""} onChange={(e) => setSelectedCitaId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">Seleccionar ficha...</option>
                  {citasPaciente.map((c) => {
                    const fecha = new Date((c.fecha as string) + "T12:00:00");
                    return (
                      <option key={c.id as number} value={c.id as number}>
                        IDX: {c.idx as string} — {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} {c.hora_inicio as string}
                      </option>
                    );
                  })}
                </Select>
              </div>
            )}
            {citasPaciente.length === 0 && selectedPacienteId && (
              <p className="text-xs text-amber-500">No se encontraron fichas de solicitud para este paciente</p>
            )}

            <input type="hidden" name="cita_id" value={selectedCitaId || ""} />

            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Título</label>
              <input name="titulo" required className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 transition-all duration-200 dark:border-white/10 dark:bg-[#1a1f2e] dark:text-white" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1.5">Archivo PDF</label>
              <input type="file" name="archivo" accept=".pdf" required className="w-full text-sm text-gray-600 dark:text-white/60 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:bg-gradient-to-r file:from-cyan-500 file:to-blue-500 file:text-white file:cursor-pointer cursor-pointer" />
            </div>
            <Button type="submit" className="w-full" disabled={uploading || !selectedCitaId}>
              <Upload size={16} className="mr-2" /> {uploading ? "Subiendo..." : "Subir resultado"}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Recepcionista / Admin: approve/reject + view
  if (canApprove) {
    const pendientes = resultados.filter(r => r.estado === "pendiente");
    const aprobados = resultados.filter(r => r.estado === "aprobado" || r.estado === "rechazado");

    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Resultados</h1>
            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Revisión y aprobación de resultados</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTab("pending")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "pending" ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04] dark:text-white/40"}`}>
              Pendientes {pendientes.length > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[9px]">{pendientes.length}</span>}
            </button>
            <button onClick={() => setTab("approved")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "approved" ? "bg-gray-900/10 text-gray-900 dark:bg-white/10 dark:text-white" : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04] dark:text-white/40"}`}>
              Procesados
            </button>
          </div>
        </div>

        {tab === "pending" && (
          pendientes.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-white/30 text-sm">No hay resultados pendientes de aprobación</div>
          ) : (
            <div className="space-y-3">
              {pendientes.map((r) => {
                const tests = (r.cita_tests as Record<string, unknown>[]) || [];
                return (
                <div key={r.id as number} className="rounded-xl border border-amber-200 bg-amber-50/50 dark:border-amber-500/20 dark:bg-amber-500/5 p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-400 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(r.paciente_nombre as string)?.[0]}{(r.paciente_apellido as string)?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.paciente_nombre as string} {r.paciente_apellido as string}</p>
                        <p className="text-xs text-gray-500 dark:text-white/40">{r.titulo as string} — subido por {r.subido_por_nombre as string} {r.subido_por_apellido as string}</p>
                        {(r.cita_fecha as string) && (
                          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                            {r.cita_fecha as string} {r.cita_hora_inicio as string}{r.cita_idx ? ` — IDX: ${r.cita_idx}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => window.open(`/api/resultados/download/${r.id}`, "_blank")} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 transition-all" title="Descargar PDF">
                        <Download size={16} />
                      </button>
                      <button onClick={() => handleAprobar(r.id as number)} className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-500/10 transition-all" title="Aprobar">
                        <Check size={16} />
                      </button>
                      <button onClick={() => handleRechazar(r.id as number)} className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-all" title="Rechazar">
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  {tests.length > 0 && (
                    <div className="border-t border-amber-200/50 dark:border-amber-500/10 pt-2 mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-1.5 flex items-center gap-1">
                        <FlaskConical size={10} /> Análisis realizados
                      </p>
                      <div className="space-y-1">
                        {tests.map((t) => (
                          <div key={t.id as number} className="flex items-center justify-between rounded-lg bg-white/50 dark:bg-white/[0.02] px-2.5 py-1">
                            <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                              {(t.test_id as string).replace(/_/g, " ")}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-2 ${analysisStateColors[t.estado as string] || analysisStateColors.pendiente}`}>
                              {(t.estado as string) === "en_proceso" ? "Proceso" : (t.estado as string)?.charAt(0).toUpperCase() + (t.estado as string)?.slice(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )
        )}

        {tab === "approved" && (
          aprobados.length === 0 ? (
            <div className="text-center py-12 text-gray-400 dark:text-white/30 text-sm">No hay resultados procesados</div>
          ) : (
            <div className="space-y-3">
              {aprobados.map((r) => {
                const tests = (r.cita_tests as Record<string, unknown>[]) || [];
                return (
                <div key={r.id as number} className="rounded-xl border border-gray-200 bg-white p-4 dark:border-white/5 dark:bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {(r.paciente_nombre as string)?.[0]}{(r.paciente_apellido as string)?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{r.paciente_nombre as string} {r.paciente_apellido as string}</p>
                        <p className="text-xs text-gray-500 dark:text-white/40">{r.titulo as string}</p>
                        {(r.cita_fecha as string) && (
                          <p className="text-xs text-gray-400 dark:text-white/30 mt-0.5">
                            {r.cita_fecha as string} {r.cita_hora_inicio as string}{r.cita_idx ? ` — IDX: ${r.cita_idx}` : ""}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => window.open(`/api/resultados/download/${r.id}`, "_blank")} className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10 transition-all" title="Descargar PDF">
                        <Download size={16} />
                      </button>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${estadoColors[r.estado as string] || ""}`}>
                        {r.estado === "aprobado" ? "Aprobado" : "Rechazado"}
                      </span>
                    </div>
                  </div>
                  {tests.length > 0 && (
                    <div className="border-t border-gray-100 dark:border-white/5 pt-2 mt-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 mb-1.5 flex items-center gap-1">
                        <FlaskConical size={10} /> Análisis realizados
                      </p>
                      <div className="space-y-1">
                        {tests.map((t) => (
                          <div key={t.id as number} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/[0.02] px-2.5 py-1">
                            <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                              {(t.test_id as string).replace(/_/g, " ")}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-2 ${analysisStateColors[t.estado as string] || analysisStateColors.pendiente}`}>
                              {(t.estado as string) === "en_proceso" ? "Proceso" : (t.estado as string)?.charAt(0).toUpperCase() + (t.estado as string)?.slice(1)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
              })}
            </div>
          )
        )}
      </div>
    );
  }

  // Paciente: their own results (backend already filters by paciente_id)
  const resultadosMap: Record<number, Record<string, unknown>> = {};
  for (const r of resultados) {
    const citaId = r.cita_id as number;
    if (citaId && r.estado === "aprobado") resultadosMap[citaId] = r;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Resultados</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Tus análisis y resultados</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Cargando...</div>
      ) : citas.filter(c => resultadosMap[c.id as number]).length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">No hay resultados registrados</div>
      ) : (
        <div className="max-w-3xl space-y-4">
          {citas.filter(c => resultadosMap[c.id as number]).map((c) => {
            const citaId = c.id as number;
            const tests = (c.tests as Record<string, unknown>[]) || (c.analisis_solicitados as Record<string, unknown>[]) || [];
            const completadosCount = tests.filter((t) => t.estado === "completado").length;
            const total = tests.length;
            const fecha = new Date((c.fecha as string) + "T12:00:00");
            const resultado = resultadosMap[citaId];

            return (
              <div key={citaId} className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/5 dark:bg-white/[0.02]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                      {(c.paciente_nombre as string)?.[0]}{(c.paciente_apellido as string)?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">
                        {c.paciente_nombre as string} {c.paciente_apellido as string}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-white/40 mt-0.5 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock size={10} />
                          {fecha.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })} — {c.hora_inicio as string}
                        </span>
                        {!!c.medico && (
                          <span className="flex items-center gap-1">
                            <User size={10} />
                            {c.medico as string}
                          </span>
                        )}
                        {!!c.idx && <span className="font-mono text-[10px]">IDX: {c.idx as string}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {total > 0 && completadosCount === total && resultado ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-600 dark:text-green-400">
                        <CheckCircle2 size={10} className="mr-1" /> Completo
                      </span>
                    ) : (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        completadosCount > 0
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400"
                      }`}>
                        {completadosCount}/{total}
                      </span>
                    )}
                  </div>
                </div>

                {tests.length > 0 && (
                  <div className="mt-2 border-t border-gray-100 dark:border-white/5 pt-2">
                    <button onClick={() => toggleExpand(citaId)} className="w-full flex items-center justify-between gap-2 text-left">
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-1">
                        <FlaskConical size={10} />
                        Análisis ({completadosCount}/{total})
                      </p>
                      <span className="text-gray-400 dark:text-white/30">
                        {expandedCitas.has(citaId) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>
                    {expandedCitas.has(citaId) && (
                      <div className="mt-1.5 space-y-1">
                        {tests.map((t) => {
                          const estado = (t.estado as string) || "pendiente";
                          return (
                            <div key={t.id as number} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/[0.02] px-2.5 py-1.5">
                              <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                                {(t.test_id as string).replace(/_/g, " ")}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-2 ${analysisStateColors[estado] || analysisStateColors.pendiente}`}>
                                {estado === "completado" ? <CheckCircle2 size={9} /> : estado === "en_proceso" ? <Loader size={9} /> : <Circle size={9} />}
                                {estado === "en_proceso" ? "Proceso" : estado.charAt(0).toUpperCase() + estado.slice(1)}
                              </span>
                            </div>
                          );
                        })}
                        {completadosCount === total && resultado && (
                          <div className="flex items-center gap-1 pt-1">
                            <button onClick={() => window.open(`/api/resultados/download/${resultado.id}`, "_blank")} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-500/10 dark:text-green-400 transition-all" title="Descargar PDF">
                              <Download size={10} /> PDF
                            </button>
                            <button onClick={() => setQrId(resultado.id as number)} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 dark:text-white/50 transition-all" title="Compartir por QR">
                              <QrCode size={10} /> QR
                            </button>
                          </div>
                        )}
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

      <QRModal open={qrId !== null} onClose={() => setQrId(null)} resultadoId={qrId || 0} />
    </div>
  );
}

const analysisStateColors: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  en_proceso: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  completado: "bg-green-500/20 text-green-600 dark:text-green-400",
};
