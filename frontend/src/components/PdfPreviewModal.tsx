import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchResultadoBlob } from "@/services/api";
import { cn } from "@/lib/utils";

/**
 * CAPTURE DETERRENCE (best effort).
 *
 * A web page cannot truly prevent OS-level screenshots or screen recording
 * (Snipping Tool, OBS, phone cameras, etc.). This hook only raises the effort
 * required: it blacks out the screen whenever the page loses focus, the tab is
 * hidden, the page is being printed, or a well-known screenshot shortcut is
 * detected. The overlay clears as soon as focus returns. It is NOT bulletproof.
 */
const KEY_HOLD_MS = 3000;

export function useCaptureShield(active: boolean) {
  const [focusLost, setFocusLost] = useState(false);
  const [keyHold, setKeyHold] = useState(false);
  const [printing, setPrinting] = useState(false);
  const holdTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    // Focus inside a child iframe still counts as focus for the parent document
    // (document.hasFocus() stays true), so clicking the PDF does not black out.
    const checkFocus = () => {
      setFocusLost(document.visibilityState === "hidden" || !document.hasFocus());
    };

    const trigger = () => {
      setKeyHold(true);
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => setKeyHold(false), KEY_HOLD_MS);
      // Overwrite the clipboard: PrintScreen puts the capture there.
      try {
        navigator.clipboard?.writeText(" ").catch(() => {});
      } catch { /* clipboard unavailable */ }
    };

    const onBlur = () => window.setTimeout(checkFocus, 0);
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        trigger();
        return;
      }
      // Win+Shift+S (Windows Snip), Ctrl+Shift+S (some tools)
      if (e.shiftKey && k === "s" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        trigger();
        return;
      }
      // macOS Cmd+Shift+3/4/5
      if (e.metaKey && e.shiftKey && ["Digit3", "Digit4", "Digit5"].includes(e.code)) {
        trigger();
        return;
      }
      // Save / print shortcuts
      if ((e.ctrlKey || e.metaKey) && (k === "s" || k === "p")) {
        e.preventDefault();
        if (k === "p") trigger();
      }
    };
    const onBeforePrint = () => setPrinting(true);
    const onAfterPrint = () => setPrinting(false);

    checkFocus();
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", checkFocus);
    document.addEventListener("visibilitychange", checkFocus);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    // Polling catches focus loss that does not emit blur (e.g. overlay snip tools).
    const poll = window.setInterval(checkFocus, 500);

    return () => {
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", checkFocus);
      document.removeEventListener("visibilitychange", checkFocus);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
      window.clearInterval(poll);
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      setFocusLost(false);
      setKeyHold(false);
      setPrinting(false);
    };
  }, [active]);

  return active && (focusLost || keyHold || printing);
}

function buildWatermark(text: string) {
  const safe = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="180">` +
    `<text x="20" y="110" transform="rotate(-25 170 90)" font-family="sans-serif" font-size="14" ` +
    `fill="#808080" fill-opacity="0.22">${safe}</text></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

interface CaptureShieldProps {
  children: ReactNode;
  /** Text repeated as a faint watermark (e.g. viewer name + email). */
  watermark?: string;
  className?: string;
  active?: boolean;
}

/**
 * Wraps sensitive content: disables selection / copy / context menu / drag,
 * overlays a repeating watermark and blacks out the whole screen when a capture
 * attempt is detected. Best-effort only, see useCaptureShield.
 */
export function CaptureShield({ children, watermark, className, active = true }: CaptureShieldProps) {
  const blocked = useCaptureShield(active);
  const bg = useMemo(() => (watermark ? buildWatermark(watermark) : undefined), [watermark]);
  const stop = (e: React.SyntheticEvent) => { if (active) e.preventDefault(); };

  return (
    <div
      className={cn("capture-shield-root relative select-none", className)}
      onContextMenu={stop}
      onCopy={stop}
      onCut={stop}
      onDragStart={stop}
      onSelectCapture={stop}
      style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
    >
      {children}
      {bg && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none z-10"
          style={{ backgroundImage: bg, backgroundRepeat: "repeat" }}
        />
      )}
      {blocked &&
        createPortal(
          <div
            className="capture-shield-overlay fixed inset-0 z-[9999] bg-black flex items-center justify-center"
            role="alert"
          >
            <p className="text-white/40 text-sm flex items-center gap-2">
              <ShieldAlert size={16} /> Contenido protegido. Vuelve a la ventana para continuar.
            </p>
          </div>,
          document.body
        )}
    </div>
  );
}

interface PdfPreviewModalProps {
  open: boolean;
  onClose: () => void;
  resultadoId: number | null;
  titulo?: string;
}

export function PdfPreviewModal({ open, onClose, resultadoId, titulo }: PdfPreviewModalProps) {
  const { user } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open || resultadoId === null) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoading(true);
    setError("");
    setUrl(null);
    fetchResultadoBlob(resultadoId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el documento");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [open, resultadoId, attempt]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const watermark = user ? `${user.nombre} ${user.apellido} · ${user.email}` : "LIFELAB · confidencial";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-6">
      <div className="flex flex-col w-full max-w-5xl h-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {titulo ? `Vista previa — ${titulo}` : "Vista previa del resultado"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <CaptureShield watermark={watermark} className="flex-1 min-h-0 bg-gray-100 dark:bg-black/40">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 text-gray-500 dark:text-white/40">
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm">Cargando documento...</span>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
              <p className="text-sm text-red-500">{error}</p>
              <button
                onClick={() => setAttempt((n) => n + 1)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 text-sm text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5"
              >
                Reintentar
              </button>
            </div>
          )}
          {url && (
            <>
              <iframe
                title="Vista previa del resultado"
                src={`${url}#toolbar=0&navpanes=0&scrollbar=1`}
                className="absolute inset-0 w-full h-full border-0"
              />
              {/* Transparent layer over the viewer's top bar to discourage its download/print buttons. */}
              <div aria-hidden className="absolute top-0 left-0 right-0 h-12 z-20" />
            </>
          )}
        </CaptureShield>
      </div>
    </div>
  );
}
