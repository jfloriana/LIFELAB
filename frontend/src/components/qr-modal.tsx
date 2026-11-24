import { useState, useEffect, useRef, useCallback } from "react";
import { Download, RefreshCw, Lock } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { CaptureShield } from "@/components/PdfPreviewModal";
import { compartirResultado, getQrEstado, QrLimitError, type CompartirResponse } from "@/services/api";

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  resultadoId: number;
}

const POLL_INTERVAL_MS = 4000;

function minutesLabel(seconds: number): string {
  const m = Math.max(1, Math.ceil(seconds / 60));
  return `${m} ${m === 1 ? "minuto" : "minutos"}`;
}

function clock(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function QRModal({ open, onClose, resultadoId }: QRModalProps) {
  const { user } = useAuth();
  const [data, setData] = useState<CompartirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [generados, setGenerados] = useState<number | null>(null);
  // Absolute time (ms) at which generating becomes possible again; null when not rate limited.
  const [limitUntil, setLimitUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const QRCodeLib = useRef<typeof import("qrcode") | null>(null);
  // Guards against double generation (StrictMode effects, poll racing a manual click).
  const inFlight = useRef(false);
  // True once the displayed QR was seen active; only then does "inactive" mean "it was used".
  const wasActive = useRef(false);
  const currentToken = useRef<string | null>(null);
  const isOpen = useRef(open);
  isOpen.current = open;

  useEffect(() => {
    import("qrcode").then((mod) => { QRCodeLib.current = mod; });
  }, []);

  const generar = useCallback(async (auto = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError("");
    try {
      const res = await compartirResultado(resultadoId);
      if (!isOpen.current) return;
      wasActive.current = false;
      currentToken.current = res.token;
      setLimitUntil(null);
      setGenerados(res.generados);
      setNotice(auto ? "El código anterior fue escaneado. Se generó uno nuevo." : "");
      setData(res);
    } catch (err) {
      if (!isOpen.current) return;
      currentToken.current = null;
      wasActive.current = false;
      if (err instanceof QrLimitError) {
        setData(null);
        setNotice("");
        setNow(Date.now());
        setLimitUntil(Date.now() + err.reintentoEnSegundos * 1000);
      } else {
        setError(err instanceof Error ? err.message : "Error al generar QR");
      }
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [resultadoId]);

  useEffect(() => {
    if (open) {
      generar();
    } else {
      setData(null);
      setError("");
      setNotice("");
      setLimitUntil(null);
      setGenerados(null);
      currentToken.current = null;
      wasActive.current = false;
    }
  }, [open, generar]);

  // While a QR is displayed, watch whether it was consumed and renew it automatically.
  const token = data?.token ?? null;
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;

    async function poll() {
      if (cancelled || document.hidden || inFlight.current) return;
      const polled = token;
      try {
        const estado = await getQrEstado(resultadoId);
        if (cancelled || currentToken.current !== polled || inFlight.current) return;
        setGenerados(estado.generados);
        if (estado.activo) {
          wasActive.current = true;
        } else if (wasActive.current) {
          wasActive.current = false;
          generar(true);
        }
      } catch {
        // Transient failures are ignored; the next tick retries.
      }
    }

    const id = setInterval(poll, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) poll(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [open, token, resultadoId, generar]);

  // Live countdown while rate limited; retries once when it reaches zero.
  useEffect(() => {
    if (limitUntil === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= limitUntil) {
        clearInterval(id);
        setLimitUntil(null);
        generar();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [limitUntil, generar]);

  useEffect(() => {
    if (data && canvasRef.current && QRCodeLib.current) {
      QRCodeLib.current.toCanvas(canvasRef.current, data.url, {
        width: 280,
        margin: 2,
        color: { dark: "#ffffff", light: "#111827" },
      });
    }
  }, [data]);

  const remaining = limitUntil === null ? 0 : Math.max(0, Math.ceil((limitUntil - now) / 1000));
  const limite = data?.limite ?? 5;
  const ventana = data?.ventana_horas ?? 2;

  function descargar() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-resultado-${resultadoId}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Compartir resultado">
      {/* Extra bottom padding on touch devices so the fixed hold-to-view bar never overlaps the dialog */}
      <div className="flex flex-col items-center gap-4 pointer-coarse:pb-24">
        {loading && (
          <div className="flex items-center gap-2 text-text-muted">
            <RefreshCw size={18} className="animate-spin" />
            <span>Generando...</span>
          </div>
        )}
        {error && <p className="text-danger text-sm">{error}</p>}
        {limitUntil !== null && (
          <div role="alert" className="flex flex-col items-center gap-2 text-center max-w-xs">
            <Lock size={28} className="text-danger" aria-hidden="true" />
            <p className="text-danger text-sm">
              Alcanzaste el límite de códigos QR. Inténtalo de nuevo en {minutesLabel(remaining)}.
            </p>
            <p className="text-text-muted text-xs tabular-nums">Disponible en {clock(remaining)}</p>
          </div>
        )}
        {data && (
          <>
            {notice && (
              <p role="status" className="text-sm text-center text-primary">{notice}</p>
            )}
            <CaptureShield holdToView watermark={user ? `${user.nombre} ${user.apellido} · ${user.email}` : "LIFELAB · confidencial"} className="flex flex-col items-center gap-4">
              <div className="bg-surface rounded-xl p-4">
                <canvas ref={canvasRef} className="rounded-lg" />
              </div>
              <p className="text-text-muted text-xs text-center break-all max-w-xs">
                {data.url}
              </p>
            </CaptureShield>
            {generados !== null && (
              <p className="text-text-muted text-xs text-center">
                Código {generados} de {limite} en las últimas {ventana} horas
              </p>
            )}
            <div className="flex gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={descargar}>
                <Download size={16} className="mr-2" /> Descargar QR
              </Button>
              <Button size="sm" onClick={() => generar()} disabled={loading}>
                <RefreshCw size={16} className="mr-2" /> Regenerar
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
