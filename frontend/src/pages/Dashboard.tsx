import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Calendar, FileText,
  Clock, ArrowRight, Activity, FlaskConical,
  TrendingUp, UserPlus, Plus, BarChart3,
  ChevronRight, CalendarDays, Stethoscope,
  Shield, Syringe, Microscope, ClipboardList
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getPacientes, getCitas, getResultados, getUsers } from "@/services/api";
import { useToast } from "@/components/ui/use-toast";

const roleGreetings: Record<string, string> = {
  admin: "Panel de Administración",
  recepcionista: "Gestión de Recepción",
  bioanalista: "Panel de Análisis",
  paciente: "Tu Portal de Salud",
};

const roleDescriptions: Record<string, string> = {
  admin: "Resumen general del laboratorio",
  recepcionista: "Control de citas y pacientes",
  bioanalista: "Resultados y análisis pendientes",
  paciente: "Tus citas y resultados de laboratorio",
};

const roleIcon: Record<string, React.ElementType> = {
  admin: Shield,
  recepcionista: CalendarDays,
  bioanalista: Microscope,
  paciente: Stethoscope,
};

interface Cita {
  id: number;
  paciente_nombre?: string;
  paciente_apellido?: string;
  fecha: string;
  hora_inicio: string;
  hora_fin?: string;
  estado?: string;
  medico?: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    pacientes: 0,
    citas: 0,
    resultados: 0,
    usuarios: 0,
    citasHoy: 0,
  });
  const [upcomingCitas, setUpcomingCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
        const [pacientes, citas, resultados, users] = await Promise.all([
          getPacientes().catch(() => []),
          getCitas().catch(() => []),
          getResultados().catch(() => []),
          role === "admin" ? getUsers().catch(() => []) : [],
        ]);

      const citaList = Array.isArray(citas) ? (citas as Cita[]) : [];
      const hoy = citaList.filter((c) => (c.fecha as string) === today);
      const upcoming = citaList
        .filter((c) => (c.fecha as string) >= today)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora_inicio.localeCompare(b.hora_inicio))
        .slice(0, 5);

      setStats({
        pacientes: Array.isArray(pacientes) ? pacientes.length : 0,
        citas: citaList.length,
        resultados: Array.isArray(resultados) ? resultados.length : 0,
        usuarios: Array.isArray(users) ? users.length : 0,
        citasHoy: hoy.length,
      });
      setUpcomingCitas(upcoming);
    } catch { /* ignore */ }
    setLoading(false);
  }

  const role = user?.role || "paciente";
  const { toast } = useToast();
  const greeting = roleGreetings[role] || "Dashboard";
  const desc = roleDescriptions[role] || "";
  const Icon = roleIcon[role] || Shield;

  const isStaff = role !== "paciente" && role !== "bioanalista";
  const fullName = user?.nombre && user?.apellido ? `${user.nombre} ${user.apellido}` : "Usuario";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center ring-1 ring-cyan-500/20 dark:from-cyan-500/10 dark:to-blue-500/10">
            <Icon className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-white/40 mt-1">{desc}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 dark:border-white/5 dark:bg-white/[0.02]">
          <Clock className="h-4 w-4 text-cyan-500" />
          <span className="text-sm text-gray-600 dark:text-white/60 font-medium">
            {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
      </div>

      {role === "bioanalista" && (
        <>
          <div className="flex gap-3">
            <StatCard icon={ClipboardList} label="Mis Citas" value={stats.citasHoy} color="from-cyan-500 to-blue-500" href="/citas" navigate={navigate} loading={loading} subtitle={`${stats.citas} totales`} />
            <StatCard icon={FlaskConical} label="Resultados" value={stats.resultados} color="from-cyan-500 to-blue-500" href="/resultados" navigate={navigate} loading={loading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-cyan-500" />
                Acciones Rápidas
              </h2>
              <div className="space-y-2">
                <QuickAction icon={FlaskConical} label="Subir Resultados" href="/resultados" navigate={navigate} />
                <QuickAction icon={BarChart3} label="Reportes" href="/reportes" navigate={navigate} />
                <QuickAction icon={Calendar} label="Ver Citas" href="/citas" navigate={navigate} />
              </div>
            </div>
          </div>
        </>
      )}

      {isStaff && (
        <>
          <div className="flex gap-3">
            <StatCard icon={Users} label="Pacientes" value={stats.pacientes} color="from-cyan-500 to-blue-500" href="/pacientes" navigate={navigate} loading={loading} />
            <StatCard icon={Calendar} label="Citas Hoy" value={stats.citasHoy} color="from-teal-500 to-cyan-500" href="/citas" navigate={navigate} loading={loading} subtitle={`${stats.citas} totales`} />
            <StatCard icon={FileText} label="Resultados" value={stats.resultados} color="from-blue-500 to-indigo-500" href="/resultados" navigate={navigate} loading={loading} />
            {role === "admin" && (
              <StatCard icon={Activity} label="Usuarios" value={stats.usuarios} color="from-purple-500 to-pink-500" href="/users" navigate={navigate} loading={loading} />
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-cyan-500" />
                  Próximas Citas
                </h2>
                <button onClick={() => navigate("/citas")} className="text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 flex items-center gap-1">
                  Ver todas <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {loading ? (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-white/30">Cargando...</div>
              ) : upcomingCitas.length === 0 ? (
                <div className="text-center py-8 text-sm text-gray-400 dark:text-white/30">No hay citas programadas</div>
              ) : (
                <div className="space-y-1">
                  {upcomingCitas.map((c) => {
                    const fecha = new Date((c.fecha as string) + "T12:00:00");
                    const isToday = c.fecha === new Date().toISOString().slice(0, 10);
                    return (
                      <div key={c.id} className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => navigate("/citas")}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isToday ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400" : "bg-gray-100 dark:bg-white/[0.04] text-gray-500 dark:text-white/40"}`}>
                          {fecha.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit" })}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {c.paciente_nombre || "Paciente"} {c.paciente_apellido || ""}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-white/40 flex items-center gap-2">
                            <span>{fecha.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" })}</span>
                            <span>•</span>
                            <span>{c.hora_inicio?.slice(0, 5)}</span>
                            {c.medico && <><span>•</span><span>{c.medico}</span></>}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 dark:text-white/20 shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                <Activity className="h-4 w-4 text-cyan-500" />
                Acciones Rápidas
              </h2>
              <div className="space-y-2">
                <QuickAction icon={Plus} label="Nueva Cita" href="/agendar-cita" navigate={navigate} />
                <QuickAction icon={UserPlus} label="Nuevo Paciente" href="/pacientes" navigate={navigate} />
                <QuickAction icon={BarChart3} label="Reportes" href="/reportes" navigate={navigate} />
                {role === "admin" && (
                  <QuickAction icon={Shield} label="Usuarios" href="/users" navigate={navigate} />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {role === "paciente" && (
        <>
          {upcomingCitas.length > 0 && (
            <div className="rounded-xl border border-cyan-200 bg-gradient-to-r from-cyan-50 to-blue-50 p-5 dark:border-cyan-500/20 dark:from-cyan-500/5 dark:to-blue-500/5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-sm shrink-0">
                  <Calendar className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-500 dark:text-white/40">Próxima Cita</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                    {new Date((upcomingCitas[0].fecha as string) + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-white/60 mt-0.5">
                    {upcomingCitas[0].hora_inicio?.slice(0, 5)} — {upcomingCitas[0].medico || "Sin médico asignado"}
                  </p>
                  <button onClick={() => navigate("/citas")} className="mt-3 text-sm text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 font-medium flex items-center gap-1">
                    Ver mis citas <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button onClick={() => navigate("/citas")}
              className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:shadow-md hover:border-cyan-500/30 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shadow-sm">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Mis Citas</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Programa o revisa tus citas</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-cyan-600 dark:text-cyan-400 group-hover:gap-2 transition-all">
                <span>Ir a citas</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1 transition-all group-hover:ml-2" />
              </div>
            </button>

            <button onClick={() => navigate("/resultados")}
              className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:shadow-md hover:border-cyan-500/30 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center shadow-sm">
                  <FlaskConical className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Mis Resultados</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Consulta tus análisis</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-teal-600 dark:text-teal-400 group-hover:gap-2 transition-all">
                <span>Ver resultados</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1 transition-all group-hover:ml-2" />
              </div>
            </button>

            <button onClick={() => navigate("/resenas")}
              className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:shadow-md hover:border-cyan-500/30 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-sm">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Mis Reseñas</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Comparte tu experiencia</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-purple-600 dark:text-purple-400 group-hover:gap-2 transition-all">
                <span>Dejar reseña</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1 transition-all group-hover:ml-2" />
              </div>
            </button>

            <button onClick={() => navigate("/perfil")}
              className="group rounded-xl border border-gray-200 bg-white p-5 text-left transition-all hover:shadow-md hover:border-cyan-500/30 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-500/30">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-sm">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">Mi Perfil</p>
                  <p className="text-xs text-gray-500 dark:text-white/40">Actualiza tus datos</p>
                </div>
              </div>
              <div className="flex items-center text-sm text-amber-600 dark:text-amber-400 group-hover:gap-2 transition-all">
                <span>Ir a perfil</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1 transition-all group-hover:ml-2" />
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  href,
  navigate,
  loading,
  subtitle,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  href: string;
  navigate: (path: string) => void;
  loading: boolean;
  subtitle?: string;
}) {
  return (
    <button onClick={() => navigate(href)}
      className="group flex-1 min-w-0 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:shadow-md hover:border-cyan-500/30 dark:border-white/5 dark:bg-white/[0.02] dark:hover:border-cyan-500/30">
      <div className="flex items-start justify-between mb-2">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <TrendingUp className="h-3.5 w-3.5 text-gray-300 dark:text-white/20" />
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-white">{loading ? "..." : value}</p>
      <p className="text-xs text-gray-500 dark:text-white/40 mt-0.5">{label}</p>
      {subtitle && <p className="text-[10px] text-gray-400 dark:text-white/20 mt-0.5">{subtitle}</p>}
    </button>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  navigate,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  navigate: (path: string) => void;
}) {
  return (
    <button onClick={() => navigate(href)}
      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 dark:text-white/60 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors group">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center group-hover:bg-cyan-50 dark:group-hover:bg-cyan-500/10 transition-colors">
        <Icon className="h-4 w-4 text-gray-500 dark:text-white/40 group-hover:text-cyan-500 transition-colors" />
      </div>
      <span className="flex-1 text-left">{label}</span>
      <ChevronRight className="h-3.5 w-3.5 text-gray-300 dark:text-white/20" />
    </button>
  );
}
