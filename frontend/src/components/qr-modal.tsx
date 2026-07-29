import { useState, useEffect, useRef } from "react";
import { Download, RefreshCw } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { compartirResultado, type CompartirResponse } from "@/services/api";

interface QRModalProps {
  open: boolean;
  onClose: () => void;
  resultadoId: number;
}

export function QRModal({ open, onClose, resultadoId }: QRModalProps) {
  const [data, setData] = useState<CompartirResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const QRCodeLib = useRef<typeof import("qrcode") | null>(null);

  useEffect(() => {
    import("qrcode").then((mod) => { QRCodeLib.current = mod; });
  }, []);

  async function generar() {
    setLoading(true);
    setError("");
    try {
      const res = await compartirResultado(resultadoId);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al generar QR");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) generar();
  }, [open, resultadoId]);

  useEffect(() => {
    if (data && canvasRef.current && QRCodeLib.current) {
      QRCodeLib.current.toCanvas(canvasRef.current, data.url, {
        width: 280,
        margin: 2,
        color: { dark: "#ffffff", light: "#111827" },
      });
    }
  }, [data]);

  function descargar() {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `qr-resultado-${resultadoId}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Compartir resultado">
      <div className="flex flex-col items-center gap-4">
        {loading && (
          <div className="flex items-center gap-2 text-text-muted">
            <RefreshCw size={18} className="animate-spin" />
            <span>Generando...</span>
          </div>
        )}
        {error && <p className="text-danger text-sm">{error}</p>}
        {data && (
          <>
            <div className="bg-surface rounded-xl p-4">
              <canvas ref={canvasRef} className="rounded-lg" />
            </div>
            <p className="text-text-muted text-xs text-center break-all max-w-xs">
              {data.url}
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="outline" size="sm" onClick={descargar}>
                <Download size={16} className="mr-2" /> Descargar QR
              </Button>
              <Button size="sm" onClick={generar}>
                <RefreshCw size={16} className="mr-2" /> Regenerar
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
