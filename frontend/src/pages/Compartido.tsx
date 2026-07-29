import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Download, FileText, Calendar, User, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const API_BASE = "/api";

export default function Compartido() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [info, setInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("Token no válido"); setLoading(false); return; }
    fetch(`${API_BASE}/compartido/${encodeURIComponent(token)}`)
      .then((r) => r.json().then((d) => ({ status: r.status, data: d })))
      .then(({ status, data }) => {
        if (status !== 200) throw new Error(data.error || "Resultado no encontrado");
        setInfo(data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = () => {
    if (!token) return;
    window.open(`${API_BASE}/compartido/${encodeURIComponent(token)}/download`, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-gray-500 dark:text-white/40 text-sm">Cargando resultado...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Resultado no disponible</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/40">{error}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-white/30">El enlace puede haber expirado o no ser válido.</p>
        </div>
      </div>
    );
  }

  const fecha = info?.cita_fecha ? new Date((info.cita_fecha as string) + "T12:00:00") : null;
  const created = info?.created_at ? new Date(info.created_at as string) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center mx-auto">
            <FileText size={24} className="text-white" />
          </div>
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-white">Resultado de Laboratorio</h1>
          <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Compartido por LIFELAB</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/[0.02] space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-white/30">Información del paciente</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/20 text-green-600 dark:text-green-400">
              <CheckCircle2 size={10} /> Compartido
            </span>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                {(info?.paciente_nombre as string)?.[0]}{(info?.paciente_apellido as string)?.[0]}
              </div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{info?.paciente_nombre as string} {info?.paciente_apellido as string}</p>
                <p className="text-xs text-gray-500 dark:text-white/40">{info?.titulo as string}</p>
              </div>
            </div>

            {(fecha || info?.hora_inicio) && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/50">
                <Calendar size={14} />
                {fecha && <span>{fecha.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</span>}
                {info?.hora_inicio && <span>— {info.hora_inicio as string}</span>}
              </div>
            )}

            {info?.medico && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/50">
                <User size={14} />
                <span>{info.medico as string}</span>
              </div>
            )}

            {created && (
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-white/50">
                <Clock size={14} />
                <span>Subido el {created.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            )}
          </div>

          {info?.archivo_nombre && (
            <div className="border-t border-gray-100 dark:border-white/5 pt-4">
              <p className="text-xs text-gray-400 dark:text-white/30 mb-2">Archivo: {info.archivo_nombre as string}</p>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium text-sm hover:opacity-90 transition-opacity"
              >
                <Download size={16} />
                Descargar PDF
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-400 dark:text-white/20 text-center pt-2">
            Este enlace ha sido desactivado después de ser visualizado por seguridad.
          </p>
        </div>

        <div className="text-center mt-8">
          <a href="https://lifelab-cyan.vercel.app" className="text-xs text-gray-400 dark:text-white/30 hover:text-primary transition-colors">
            LIFELAB — Portal de Laboratorio
          </a>
        </div>
      </div>
    </div>
  );
}