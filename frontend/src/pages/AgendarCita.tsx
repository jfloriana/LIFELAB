import { useState, useEffect, useRef } from "react";
import { Calendar, FileText, Stethoscope, Microscope, Search, Plus, FlaskConical } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CalendarPicker, formatDateString, normalizeDateString } from "@/components/ui/apple-calendar-picker";
import { createPaciente, buscarPacientes, createCita } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";

const bioanalistas = [
  { id: 1, nombre: "JOSUE HERNANDEZ DAVALOS" },
  { id: 2, nombre: "Ana López" },
];

const analisisCategorias = [
  {
    icon: "🩸",
    nombre: "HEMATOLOGÍA",
    items: [
      "Biometría Hemática Completa",
      "Grupo Sanguíneo y RH",
      "Coombs Directo / Indirecto",
      "Tiempo de Protrombina",
      "Tiempo de Tromboplastina Parcial",
      "Prueba de Embarazo",
    ],
  },
  {
    icon: "🛡️",
    nombre: "INMUNOLOGÍA RUTINA",
    items: [
      "Reacciones Febriles",
      "Antiestreptolisinas",
      "Factor Reumatoide",
      "Proteína C Reactiva",
      "VDRL",
    ],
  },
  {
    icon: "🦠",
    nombre: "BACTERIOLOGÍA",
    items: [
      "Ex. Faríngeo",
      "Ex. Cervicovaginal",
      "Ex. Vulvar",
      "Urocultivo",
      "Coprocultivo",
      "BAAR",
    ],
  },
  {
    icon: "⚗️",
    nombre: "QUÍMICA CLÍNICA",
    items: [
      "Química Sanguínea Completa (6)",
      "Química Sanguínea (GLU, UREA, CREA)",
      "Urea",
      "Creatinina",
      "Glucosa",
      "Ác. Úrico",
      "Colesterol",
      "Triglicéridos",
      "Perfil de Lípidos",
      "Perfil de Funcionamiento Hepático",
      "Electrolitos Séricos",
    ],
  },
  {
    icon: "🔬",
    nombre: "INMUNOLOGÍA ESPECIAL",
    items: [
      "Perfil Tiroideo",
      "Antígeno Prostático Específico Total (PSA)",
      "Fracc. Beta de la HGC",
      "Prolactina",
    ],
  },
  {
    icon: "🪱",
    nombre: "PARASITOLOGÍA",
    items: [
      "Amiba en Fresco",
      "Coproparasitoscópico (1)",
      "Coproparasitoscópico (3)",
      "Sangre Oculta en Heces",
    ],
  },
  {
    icon: "🧪",
    nombre: "UROANÁLISIS",
    items: [
      "Examen Gral. de Orina",
      "Proteína de Bence Jones",
    ],
  },
];

const horarios = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30",
  "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
];

export default function AgendarCita() {
  const { toast } = useToast();
  const [selectedBioanalista, setSelectedBioanalista] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return formatDateString(d);
  });
  const [showCalendar, setShowCalendar] = useState(false);
  const [edad, setEdad] = useState("");
  const [idx, setIdx] = useState("");
  const [pacienteSearch, setPacienteSearch] = useState("JOEL ARÉVALO");
  const [selectedTime, setSelectedTime] = useState("");
  const [analisisSelected, setAnalisisSelected] = useState<Record<string, boolean>>({});
  const [otros, setOtros] = useState("");

  const [showNuevoPaciente, setShowNuevoPaciente] = useState(false);
  const [nuevoPaciente, setNuevoPaciente] = useState({ nombre: "", apellido: "", email: "", password: "", dni: "", telefono: "", direccion: "", fecha_nacimiento: "" });
  const [creandoPaciente, setCreandoPaciente] = useState(false);
  const [showCalFechaNuevo, setShowCalFechaNuevo] = useState(false);

  const [pacientesResults, setPacientesResults] = useState<Record<string, unknown>[]>([]);
  const [showPacientesDropdown, setShowPacientesDropdown] = useState(false);
  const [selectedPacienteId, setSelectedPacienteId] = useState<number | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pacienteSearch.length < 2) { setPacientesResults([]); setShowPacientesDropdown(false); return; }
    const timer = setTimeout(async () => {
      setLoadingSearch(true);
      try {
        const data = await buscarPacientes(pacienteSearch);
        setPacientesResults(data);
        setShowPacientesDropdown(data.length > 0);
      } catch { setPacientesResults([]); }
      setLoadingSearch(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [pacienteSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowPacientesDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selectPaciente(p: Record<string, unknown>) {
    setSelectedPacienteId(p.id as number);
    setPacienteSearch(`${p.nombre as string} ${p.apellido as string}`);
    setShowPacientesDropdown(false);
    if (p.fecha_nacimiento) {
      const fn = normalizeDateString(p.fecha_nacimiento as string);
      const [y2, m2, d2] = fn.split("-").map(Number);
      const birth = new Date(y2, m2 - 1, d2);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      setEdad(`${age} años`);
    } else {
      setEdad("");
    }
  }

  const toggleAnalisis = (item: string) => {
    setAnalisisSelected(prev => ({ ...prev, [item]: !prev[item] }));
  };

  async function handleCrearPaciente(e: React.FormEvent) {
    e.preventDefault();
    setCreandoPaciente(true);
    try {
      await createPaciente(nuevoPaciente);
      setPacienteSearch(`${nuevoPaciente.nombre} ${nuevoPaciente.apellido}`);
      setShowNuevoPaciente(false);
      setNuevoPaciente({ nombre: "", apellido: "", email: "", password: "", dni: "", telefono: "", direccion: "", fecha_nacimiento: "" });
      toast("Paciente creado exitosamente", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error");
    }
    setCreandoPaciente(false);
  }

  async function handleRegistrar() {
    if (!selectedBioanalista) { toast("Selecciona un bioanalista"); return; }
    if (!selectedPacienteId) { toast("Selecciona un paciente"); return; }
    if (!selectedTime) { toast("Selecciona un horario"); return; }
    const analisis = Object.keys(analisisSelected).filter(k => analisisSelected[k]);
    if (analisis.length === 0) { toast("Selecciona al menos un análisis"); return; }
    try {
      await createCita({
        paciente_id: selectedPacienteId,
        fecha: selectedDate,
        hora_inicio: selectedTime,
        idx: idx || "",
        medico: selectedBioanalista,
        analisis_solicitados: analisis,
        notas: otros || undefined,
      });
      toast("Solicitud registrada exitosamente", "success");
      setSelectedBioanalista("");
      setSelectedPacienteId(null);
      setPacienteSearch("");
      setIdx("");
      setSelectedTime("");
      setAnalisisSelected({});
      setOtros("");
      setEdad("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Error al registrar");
    }
  }

  const tieneAnalisis = Object.keys(analisisSelected).some(k => analisisSelected[k]);
  const puedeRegistrar = !!(selectedBioanalista && selectedPacienteId && selectedTime && tieneAnalisis);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/[0.02]">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
          <Calendar className="h-5 w-5 text-cyan-500" />
          Citas - Solicitud de Laboratorio
        </h2>

        <div className="rounded-xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/[0.02]">
          <div className="border-b border-gray-100 bg-gradient-to-r from-cyan-50 to-blue-50 px-6 py-4 dark:border-white/5 dark:from-cyan-500/5 dark:to-blue-500/5">
            <div className="flex items-center gap-3">
              <Microscope className="h-8 w-8 text-cyan-500" />
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Laboratorio de Análisis Clínicos</h2>
                <p className="text-sm text-gray-500 dark:text-white/40">¡Confianza, calidez y bienestar para tu salud!</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500 dark:text-white/40">
              <span>✉️ contacto@clinica-j.com</span>
              <span>📱 TOMAS A DOMICILIO: Cosoleacaque / Jáltipan</span>
              <span>🔬 RESPONSABLE SANITARIO: Q.C. Responsable — Ced. Prof.: 000000</span>
            </div>
          </div>

          <div className="p-6">
            <h3 className="mb-6 flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
              <FileText className="h-5 w-5 text-cyan-500" />
              SOLICITUD DE LABORATORIO
            </h3>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">
                  <Stethoscope className="h-3 w-3" />
                  Bioanalista <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedBioanalista}
                  onChange={e => setSelectedBioanalista(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#1a1f2e] dark:text-white"
                >
                  <option value="">Seleccionar bioanalista...</option>
                  {bioanalistas.map(b => (
                    <option key={b.id} value={b.nombre}>{b.nombre}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">Fecha</label>
                <button type="button" onClick={() => setShowCalendar(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:border-cyan-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-cyan-500/50">
                  <Calendar size={16} className="text-cyan-500 shrink-0" />
                  <span>{(() => { const [y,m,d] = selectedDate.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }); })()}</span>
                </button>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">Edad</label>
                <input readOnly value={edad} placeholder="Edad del paciente"
                  className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/40" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">
                  IDX <span className="text-red-500">*</span>
                </label>
                <input value={idx} onChange={e => setIdx(e.target.value)} placeholder="Identificador"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
              </div>
            </div>

            <div className="mt-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">Paciente</label>
                <div className="flex gap-2">
                  <div ref={searchRef} className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input value={pacienteSearch} onChange={e => { setPacienteSearch(e.target.value); setSelectedPacienteId(null); }}
                      placeholder="Buscar paciente por nombre o DNI..."
                      className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
                    {loadingSearch && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                    {showPacientesDropdown && pacientesResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-white/10 dark:bg-[#1C1C1E] overflow-hidden">
                        {pacientesResults.map(p => (
                          <button key={p.id as number} type="button" onClick={() => selectPaciente(p)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-cyan-50 dark:hover:bg-cyan-500/10">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                              {(p.nombre as string)?.[0]}{(p.apellido as string)?.[0]}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{p.nombre as string} {p.apellido as string}</p>
                              <p className="text-xs text-gray-500 dark:text-white/40">{p.dni as string} {!!p.email && `— ${p.email as string}`}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowNuevoPaciente(true)} title="Crear nuevo paciente"
                    className="flex items-center gap-1 rounded-lg bg-cyan-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-cyan-400">
                    <Plus className="h-4 w-4" /> Nuevo
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100 p-6 dark:border-white/5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">
              Análisis solicitados <span className="text-red-500">*</span>
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {analisisCategorias.map(cat => (
                <div key={cat.nombre}
                  className="rounded-lg border border-gray-100 bg-gray-50 dark:border-white/5 dark:bg-white/[0.02] overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-white/5">
                    <span className="text-base">{cat.icon}</span>
                    <span className="text-xs font-bold tracking-wide text-gray-700 dark:text-white/60">{cat.nombre}</span>
                  </div>
                  <div className="space-y-0.5 p-3">
                    {cat.items.map(item => (
                      <label key={item}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors hover:bg-gray-100 dark:hover:bg-white/[0.04] text-gray-600 dark:text-white/50">
                        <input type="checkbox" checked={!!analisisSelected[item]} onChange={() => toggleAnalisis(item)}
                          className="h-3.5 w-3.5 rounded border-gray-300 text-cyan-500 focus:ring-cyan-400" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-white/50">Otros</label>
              <textarea rows={2} value={otros} onChange={e => setOtros(e.target.value)}
                placeholder="Indicaciones adicionales..."
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-white/10 dark:bg-white/[0.04] dark:text-white" />
            </div>
          </div>

          <div className="border-t border-gray-100 p-6 dark:border-white/5">
            <div className="mb-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-white/60">
                <Calendar className="h-4 w-4 text-cyan-500" />
                Horario Disponible — Selecciona un turno
              </label>
              <div className="flex flex-wrap gap-1.5">
                {horarios.map(h => (
                  <button key={h} onClick={() => setSelectedTime(h)}
                    className={`rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                      selectedTime === h
                        ? "bg-cyan-500 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-white/[0.04] dark:text-white/60 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-400"
                    }`}>
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <button disabled={!puedeRegistrar} onClick={handleRegistrar}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 transition-all hover:from-cyan-400 hover:to-blue-400 disabled:opacity-40 disabled:shadow-none">
              <FlaskConical className="h-4 w-4" />
              Registrar Solicitud de Laboratorio
            </button>
          </div>

          <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-3 text-center text-xs text-gray-400 dark:border-white/5 dark:bg-white/[0.01] dark:text-white/30">
            📍 Laboratorio Clínica J | 📞 Tel: 922 117 0671 / Cel: 922 146 0298
          </div>
        </div>
      </div>

      <Dialog open={showNuevoPaciente} onClose={() => !creandoPaciente && setShowNuevoPaciente(false)} title="Nuevo paciente">
        <form onSubmit={handleCrearPaciente} className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-3">Información personal</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Nombre</label>
                <Input value={nuevoPaciente.nombre} onChange={e => setNuevoPaciente({ ...nuevoPaciente, nombre: e.target.value.toUpperCase() })} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Apellido</label>
                <Input value={nuevoPaciente.apellido} onChange={e => setNuevoPaciente({ ...nuevoPaciente, apellido: e.target.value.toUpperCase() })} required />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-3">Contacto</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Email</label>
                <Input type="email" value={nuevoPaciente.email} onChange={e => setNuevoPaciente({ ...nuevoPaciente, email: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Teléfono</label>
                <Input value={nuevoPaciente.telefono} onChange={e => setNuevoPaciente({ ...nuevoPaciente, telefono: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/30 mb-3">Identificación</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">DNI</label>
                <Input value={nuevoPaciente.dni} onChange={e => setNuevoPaciente({ ...nuevoPaciente, dni: e.target.value })} maxLength={8} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Fecha de nacimiento</label>
                <button type="button" onClick={() => setShowCalFechaNuevo(true)}
                  className="flex w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:border-cyan-400 dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:border-cyan-500/50">
                  <span>{nuevoPaciente.fecha_nacimiento ? (() => { const [y,m,d] = nuevoPaciente.fecha_nacimiento.split("-").map(Number); return new Date(y,m-1,d).toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }); })() : "Seleccionar fecha"}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Dirección</label>
              <Input value={nuevoPaciente.direccion} onChange={e => setNuevoPaciente({ ...nuevoPaciente, direccion: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm text-gray-500 dark:text-white/40 mb-1">Contraseña</label>
              <Input type="password" value={nuevoPaciente.password} onChange={e => setNuevoPaciente({ ...nuevoPaciente, password: e.target.value })} required />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="ghost" onClick={() => setShowNuevoPaciente(false)} className="flex-1" disabled={creandoPaciente}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={creandoPaciente}>
              {creandoPaciente ? "Creando..." : "Crear paciente"}
            </Button>
          </div>
        </form>
      </Dialog>

      <CalendarPicker
        isOpen={showCalFechaNuevo}
        onClose={() => setShowCalFechaNuevo(false)}
        value={nuevoPaciente.fecha_nacimiento ? (() => { const [y,m,d] = nuevoPaciente.fecha_nacimiento.split("-").map(Number); return new Date(y,m-1,d); })() : null}
        onChange={(date) => {
          setNuevoPaciente({ ...nuevoPaciente, fecha_nacimiento: formatDateString(date) });
          setShowCalFechaNuevo(false);
        }}
      />

      <CalendarPicker
        isOpen={showCalendar}
        onClose={() => setShowCalendar(false)}
        value={(/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) ? (() => { const [y,m,d] = selectedDate.split("-").map(Number); return new Date(y,m-1,d); })() : null}
        onChange={(date) => setSelectedDate(formatDateString(date))}
        minDate={new Date()}
      />
    </div>
  );
}
