import { useState } from "react";
import { Download, Calendar, Microscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";

export default function Reportes() {
  const { user } = useAuth();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  const isAdmin = user?.role === "admin";
  const canViewCitas = isAdmin || user?.role === "recepcionista";
  const canViewResultados = isAdmin || user?.role === "bioanalista";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reportes</h1>
        <p className="text-sm text-gray-500 dark:text-white/40 mt-1">Genera reportes del laboratorio</p>
      </div>

      {canViewCitas && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <Calendar className="h-5 w-5 text-cyan-500" />
            Reportes de Citas
          </h3>
          <p className="text-gray-500 dark:text-white/40 text-sm mb-4">
            Descarga reportes detallados de citas programadas en el laboratorio
          </p>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Fecha inicio</label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-40" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-white/40 mb-1">Fecha fin</label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} className="w-40" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => {
              const params = new URLSearchParams();
              if (fechaInicio) params.set("fecha_inicio", fechaInicio);
              if (fechaFin) params.set("fecha_fin", fechaFin);
              window.open(`/api/reportes/citas/pdf?${params.toString()}`, "_blank");
            }}>
              <Download size={16} className="mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => {
              const params = new URLSearchParams();
              if (fechaInicio) params.set("fecha_inicio", fechaInicio);
              if (fechaFin) params.set("fecha_fin", fechaFin);
              window.open(`/api/reportes/citas/excel?${params.toString()}`, "_blank");
            }}>
              <Download size={16} className="mr-2" /> Excel
            </Button>
          </div>
        </div>
      )}

      {canViewResultados && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-white/5 dark:bg-white/[0.02]">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white mb-2">
            <Microscope className="h-5 w-5 text-cyan-500" />
            Reportes de Resultados
          </h3>
          <p className="text-gray-500 dark:text-white/40 text-sm mb-4">
            Descarga reportes de resultados de análisis de laboratorio
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open("/api/reportes/resultados/pdf", "_blank")}>
              <Download size={16} className="mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.open("/api/reportes/resultados/excel", "_blank")}>
              <Download size={16} className="mr-2" /> Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
