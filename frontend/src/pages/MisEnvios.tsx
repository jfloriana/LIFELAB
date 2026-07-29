import { useState, useEffect, useMemo, useRef } from "react";
import { Search, Download, FlaskConical, CheckCircle2, Loader, ChevronDown, ChevronUp, Circle } from "lucide-react";
import { getResultados } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const estadoColors: Record<string, string> = {
  pendiente: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  aprobado: "bg-green-500/20 text-green-600 dark:text-green-400",
  rechazado: "bg-red-500/20 text-red-600 dark:text-red-400",
};

const analysisStateColors: Record<string, string> = {
  pendiente: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  en_proceso: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  completado: "bg-green-500/20 text-green-600 dark:text-green-400",
};

type EstadoFilter = "todos" | "aprobado" | "rechazado" | "pendiente";

export default function MisEnvios() {
  const { user } = useAuth();
  const [resultados, setResultados] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedPaciente, setSelectedPaciente] = useState<{ nombre: string; apellido: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [estadoFilter, setEstadoFilter] = useState<EstadoFilter>("todos");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getResultados().then(data => {
      setResultados(Array.isArray(data) ? data : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const misEnvios = useMemo(() => {
    return resultados.filter(r => (r.subido_por as number) === user?.id);
  }, [resultados, user]);

  const pacientesUnicos = useMemo(() => {
    const map = new Map<string, { nombre: string; apellido: string }>();
    for (const r of misEnvios) {
      const key = `${r.paciente_nombre}|${r.paciente_apellido}`;
      if (!map.has(key)) {
        map.set(key, { nombre: r.paciente_nombre as string, apellido: r.paciente_apellido as string });
      }
    }
    return [...map.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [misEnvios]);

  const pacientesFiltrados = useMemo(() => {
    if (!search.trim()) return pacientesUnicos;
    const q = search.toLowerCase();
    return pacientesUnicos.filter(p =>
      p.nombre.toLowerCase().includes(q) || p.apellido.toLowerCase().includes(q)
    );
  }, [pacientesUnicos, search]);

  const filtered = useMemo(() => {
    if (!selectedPaciente) return [];
    let list = misEnvios.filter(r =>
      r.paciente_nombre === selectedPaciente.nombre &&
      r.paciente_apellido === selectedPaciente.apellido
    );
    if (estadoFilter !== "todos") {
      list = list.filter(r => r.estado === estadoFilter);
    }
    return list;
  }, [misEnvios, selectedPaciente, estadoFilter]);

  const selectPaciente = (p: { nombre: string; apellido: string }) => {
    setSelectedPaciente(p);
    setSearch(`${p.nombre} ${p.apellido}`);
    setShowDropdown(false);
  };

  const clearPaciente = () => {
    setSelectedPaciente(null);
    setSearch("");
    setShowDropdown(false);
  };

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const tabs: { key: EstadoFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "pendiente", label: "Pendientes" },
    { key: "aprobado", label: "Aprobados" },
    { key: "rechazado", label: "Rechazados" },
  ];

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mis Envíos</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">{misEnvios.length} resultado{misEnvios.length !== 1 ? "s" : ""} enviado{misEnvios.length !== 1 ? "s" : ""}</p>
      </div>

      <div ref={searchRef} className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Buscar paciente..."
          value={search}
          onChange={e => { setSearch(e.target.value); setSelectedPaciente(null); setShowDropdown(true); }}
          onFocus={() => setShowDropdown(true)}
          className="w-full h-11 pl-9 pr-8 rounded-xl border border-border bg-white dark:bg-white/5 text-foreground dark:text-white placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all text-sm"
        />
        {selectedPaciente && (
          <button onClick={clearPaciente} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white/60 text-lg leading-none">&times;</button>
        )}
        {showDropdown && search.length > 0 && pacientesFiltrados.length > 0 && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/5 dark:bg-[#1C1C1E]">
            {pacientesFiltrados.map(p => (
              <button
                key={`${p.nombre}|${p.apellido}`}
                type="button"
                onClick={() => selectPaciente(p)}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-white/60 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                {p.nombre} {p.apellido}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPaciente && (
      <div className="flex items-center gap-2">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setEstadoFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              estadoFilter === t.key
                ? "bg-gray-900/10 text-gray-900 dark:bg-white/10 dark:text-white"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.04] dark:text-white/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500 dark:text-white/40">Cargando...</div>
      ) : !selectedPaciente ? (
        <div className="text-center py-12 text-gray-400 dark:text-white/30 text-sm">Busca y selecciona un paciente para ver sus resultados</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-white/30 text-sm">No se encontraron resultados para este paciente</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
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
                      {r.cita_fecha && (
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0 ${estadoColors[r.estado as string] || estadoColors.pendiente}`}>
                      {(r.estado as string)?.charAt(0).toUpperCase() + (r.estado as string)?.slice(1)}
                    </span>
                  </div>
                </div>

                {tests.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-white/5 pt-2 mt-2">
                    <button onClick={() => toggleExpand(r.id as number)} className="w-full flex items-center justify-between gap-2 text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30 flex items-center gap-1">
                        <FlaskConical size={10} /> Análisis
                      </p>
                      <span className="text-gray-400 dark:text-white/30">
                        {expanded.has(r.id as number) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </span>
                    </button>
                    {expanded.has(r.id as number) && (
                      <div className="mt-1.5 space-y-1">
                        {tests.map((t) => (
                          <div key={t.id as number} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-white/[0.02] px-2.5 py-1.5">
                            <span className="text-[11px] text-gray-700 dark:text-white/60 truncate">
                              {(t.test_id as string).replace(/_/g, " ")}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 ml-2 ${analysisStateColors[t.estado as string] || analysisStateColors.pendiente}`}>
                              {t.estado === "completado" ? <CheckCircle2 size={9} /> : t.estado === "en_proceso" ? <Loader size={9} /> : <Circle size={9} />}
                              {t.estado === "en_proceso" ? "Proceso" : (t.estado as string)?.charAt(0).toUpperCase() + (t.estado as string)?.slice(1)}
                            </span>
                          </div>
                        ))}
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
