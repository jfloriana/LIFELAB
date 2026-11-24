import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Download, Eye, FileText, Calendar, User, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { CaptureShield, PdfPreviewModal } from "@/components/PdfPreviewModal";
import { getCompartido, previsualizarCompartido, PreviewConsumedError, QrUsedError, QR_USED_MESSAGE, type CompartidoInfo } from "@/services/api";

const API_BASE = "/api";

export default function Compartido() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<CompartidoInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The QR was already consumed by a previous preview/download (410 QR_USED).
  const [qrUsed, setQrUsed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // One preview per page load: once started it never re-enables, even if the modal is closed.
  const [previewUsed, setPreviewUsed] = useState(false);
  const previewRequest = useRef<Promise<Blob> | null>(null);

  useEffect(() => {
    if (!token) { setError("Token no válido"); setLoading(false); return; }
    getCompartido(token)
      .then((data) => setInfo(data))
      .catch((err) => {
        if (err instanceof QrUsedError) setQrUsed(true);
        else setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleDownload = () => {
    if (!token) return;
    window.open(`${API_BASE}/compartido/${encodeURIComponent(token)}/download`, "_blank");
  };

  const ticket = info?.ticket;

  const handlePreview = () => {
    if (!ticket || previewUsed) return;
    setPreviewUsed(true);
    setPreviewOpen(true);
  };

  // The request is memoized so StrictMode double effects or in-modal retries never
  // spend the single-use ticket twice; only a non-consumed failure clears the cache.
  const loadPreview = () => {
    if (!token || !ticket) return Promise.reject(new PreviewConsumedError());
    if (!previewRequest.current) {
      previewRequest.current = previsualizarCompartido(token, ticket).catch((err) => {
        if (!(err instanceof PreviewConsumedError)) previewRequest.current = null;
        throw err;
      });
    }
    return previewRequest.current;
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

  if (qrUsed) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0B] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-amber-500" />
          </div>
          <h1 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Código ya usado</h1>
          <p role="alert" className="mt-2 text-sm text-gray-500 dark:text-white/40">{QR_USED_MESSAGE}</p>
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
          <p className="mt-1 text-xs text-gray-400 dark:text-white/30">Este código ya no es válido: pudo haber sido usado, reemplazado por uno nuevo o haber expirado. Pide uno nuevo.</p>
        </div>
      </div>
    );
  }

  const fecha = info?.cita_fecha ? new Date(String(info.cita_fecha).slice(0, 10) + "T12:00:00") : null;
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

        <CaptureShield watermark="LIFELAB · confidencial" className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-white/5 dark:bg-white/[0.02] space-y-4 overflow-hidden">
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
              {ticket && (
                <>
                  <button
                    onClick={handlePreview}
                    disabled={previewUsed}
                    className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-300 dark:border-white/10 text-gray-700 dark:text-white/80 font-medium text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  >
                    <Eye size={16} />
                    {previewUsed ? "Ya previsualizado" : "Previsualizar"}
                  </button>
                  <p className="mt-1.5 text-[10px] text-gray-400 dark:text-white/30 text-center">
                    {previewUsed
                      ? "Vuelve a escanear el código QR para verlo de nuevo"
                      : "Puedes previsualizarlo una sola vez por escaneo"}
                  </p>
                </>
              )}
            </div>
          )}

          <p className="text-[10px] text-gray-400 dark:text-white/20 text-center pt-2">
            Este enlace ha sido desactivado después de ser visualizado por seguridad.
          </p>
        </CaptureShield>

        <PdfPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          resultadoId={typeof info?.id === "number" ? info.id : null}
          titulo={info?.titulo as string | undefined}
          loadBlob={loadPreview}
          traceId={ticket}
        />

        <div className="text-center mt-8">
          <a href="https://lifelab-cyan.vercel.app" className="text-xs text-gray-400 dark:text-white/30 hover:text-primary transition-colors">
            LIFELAB — Portal de Laboratorio
          </a>
        </div>
      </div>
    </div>
  );
}