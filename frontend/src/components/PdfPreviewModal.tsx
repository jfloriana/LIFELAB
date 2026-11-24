import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, RefreshCw, ShieldAlert, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchResultadoBlob } from "@/services/api";
import { cn } from "@/lib/utils";
import { PdfCanvasViewer } from "@/components/PdfCanvasViewer";

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

function escapeXml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Dense, slightly rotated tile: viewer identity + timestamp, repeated twice per tile. */
function buildWatermark(text: string, stamp: string) {
  const l1 = escapeXml(text);
  const l2 = escapeXml(stamp);
  const w = Math.max(320, Math.round(Math.max(l1.length, l2.length) * 7.6) + 60);
  const h = 150;
  const t = (y: number, label: string) =>
    `<text x="20" y="${y}" font-family="sans-serif" font-size="13" font-weight="600" ` +
    `fill="#808080" fill-opacity="0.3">${label}</text>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<g transform="rotate(-20 ${w / 2} ${h / 2})">${t(60, l1)}${t(80, l2)}${t(135, l1)}${t(155, l2)}</g></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

/** Evaluated once at mount so tests can override window.matchMedia beforehand. */
function detectTouch() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return (
    window.matchMedia("(pointer: coarse)").matches ||
    (navigator.maxTouchPoints > 0 && !window.matchMedia("(pointer: fine)").matches)
  );
}

function useIsTouch() {
  const [touch] = useState(detectTouch);
  return touch;
}

interface CaptureShieldProps {
  children: ReactNode;
  /** Text repeated as a faint watermark (e.g. viewer name + email). */
  watermark?: string;
  className?: string;
  active?: boolean;
  /** Opt-in: on touch devices keep the content covered unless a button is held. */
  holdToView?: boolean;
  /** Opt-in: cover the content after IDLE_MS without pointer/touch/key/wheel activity. */
  idleCover?: boolean;
}

const HOLD_LABEL = "Mantén presionado para ver";
const IDLE_LABEL = "Toca o mueve el mouse para ver";
const IDLE_MS = 20_000;
const WATERMARK_SHIFT_MS = 4000;

function useReducedMotion() {
  const [reduced] = useState(
    () => typeof window !== "undefined" && typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  return reduced;
}

/** Cycles the overlay watermark through a few pseudo-random offsets so a fixed crop can't always avoid it. */
function useWatermarkOffset(enabled: boolean) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!enabled) { setOffset({ x: 0, y: 0 }); return; }
    const id = window.setInterval(() => {
      setOffset({ x: Math.round((Math.random() - 0.5) * 120), y: Math.round((Math.random() - 0.5) * 120) });
    }, WATERMARK_SHIFT_MS);
    return () => window.clearInterval(id);
  }, [enabled]);
  return offset;
}

/** True after IDLE_MS without user activity; any activity clears it. */
function useIdle(enabled: boolean) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled) { setIdle(false); return; }
    let last = Date.now();
    const onActivity = () => { last = Date.now(); setIdle(false); };
    const events = ["pointermove", "pointerdown", "touchstart", "touchmove", "keydown", "wheel", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    const timer = window.setInterval(() => {
      if (Date.now() - last >= IDLE_MS) setIdle(true);
    }, 1000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      window.clearInterval(timer);
      setIdle(false);
    };
  }, [enabled]);
  return idle;
}

/**
 * Wraps sensitive content: disables selection / copy / context menu / drag,
 * overlays a repeating watermark and blacks out the whole screen when a capture
 * attempt is detected. With holdToView, touch devices only see the content while
 * a button is pressed. Best-effort only, see useCaptureShield.
 */
export function CaptureShield({ children, watermark, className, active = true, holdToView = false, idleCover = false }: CaptureShieldProps) {
  const blocked = useCaptureShield(active);
  const isTouch = useIsTouch();
  const hold = holdToView && active && isTouch;
  const [held, setHeld] = useState(false);
  const [stamp] = useState(() => new Date().toLocaleString("es"));
  const bg = useMemo(() => (watermark ? buildWatermark(watermark, stamp) : undefined), [watermark, stamp]);
  const stop = (e: React.SyntheticEvent) => { if (active) e.preventDefault(); };
  const reducedMotion = useReducedMotion();
  const offset = useWatermarkOffset(active && !!bg && !reducedMotion);
  const idle = useIdle(active && idleCover);

  useEffect(() => {
    if (!hold) return;
    const release = () => setHeld(false);
    const onVisibility = () => { if (document.visibilityState === "hidden") setHeld(false); };
    window.addEventListener("blur", release);
    window.addEventListener("contextmenu", release);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", release);
      window.removeEventListener("contextmenu", release);
      document.removeEventListener("visibilitychange", onVisibility);
      setHeld(false);
    };
  }, [hold]);

  const visible = !hold || (held && !blocked);
  const press = (e: React.PointerEvent<HTMLButtonElement>) => {
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not capturable */ }
    setHeld(true);
  };
  const release = () => setHeld(false);

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
        // Clip box + oversized inner layer so the shifting pattern never exposes an edge.
        <div aria-hidden className="absolute inset-0 overflow-hidden pointer-events-none z-30">
          <div
            className="absolute -inset-20"
            style={{
              backgroundImage: bg,
              backgroundRepeat: "repeat",
              transform: `translate(${offset.x}px, ${offset.y}px)`,
              transition: reducedMotion ? "none" : "transform 1.2s ease-in-out",
            }}
          />
        </div>
      )}
      {hold && !visible && (
        <div className="capture-shield-cover absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-white/50 pointer-events-auto">
          <Lock size={28} aria-hidden />
          <span className="text-sm font-medium">{HOLD_LABEL}</span>
        </div>
      )}
      {/* Idle cover: opaque until any activity; never stacked on the hold-to-view cover. */}
      {idle && !(hold && !visible) && (
        <div className="capture-shield-cover absolute inset-0 z-40 flex flex-col items-center justify-center gap-2 rounded-[inherit] bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-white/50 pointer-events-auto">
          <Lock size={28} aria-hidden />
          <span className="text-sm font-medium">{IDLE_LABEL}</span>
        </div>
      )}
      {hold &&
        createPortal(
          <button
            type="button"
            aria-label={HOLD_LABEL}
            aria-pressed={held}
            className="capture-hold-button fixed bottom-0 inset-x-0 z-[9000] flex items-center justify-center gap-2 h-20 pb-[env(safe-area-inset-bottom)] bg-blue-600 active:bg-blue-700 text-white text-base font-semibold select-none"
            style={{ touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
            onPointerDown={press}
            onPointerUp={release}
            onPointerCancel={release}
            onPointerLeave={release}
            onLostPointerCapture={release}
            onTouchEnd={release}
            onTouchCancel={release}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          >
            <Lock size={20} aria-hidden /> {HOLD_LABEL}
          </button>,
          document.body
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
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const isTouch = useIsTouch();
  // Per-session stamp (base36 epoch) embedded in the forensic watermark.
  const [sessionStamp] = useState(() => Date.now().toString(36));
  const [viewedAt] = useState(() => new Date().toLocaleString("es"));

  useEffect(() => {
    if (!open || resultadoId === null) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    setBlob(null);
    fetchResultadoBlob(resultadoId)
      .then((b) => { if (!cancelled) setBlob(b); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar el documento");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      setBlob(null);
    };
  }, [open, resultadoId, attempt]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const watermark = user ? `${user.nombre} ${user.apellido} · ${user.email}` : "LIFELAB · confidencial";
  const watermarkLines = useMemo(() => [watermark, viewedAt], [watermark, viewedAt]);
  const forensicCode = `LL-${user?.id ?? 0}-${resultadoId ?? 0}-${sessionStamp}`;

  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-6", isTouch && "pb-24")}>
      <div className="flex flex-col w-full max-w-5xl h-full rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-white/10">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white truncate">
            {titulo ? `Vista previa — ${titulo}` : "Vista previa del resultado"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" title="Cerrar">
            <X size={20} />
          </button>
        </div>

        <CaptureShield holdToView idleCover watermark={watermark} className="flex-1 min-h-0 bg-gray-100 dark:bg-black/40">
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
          {blob && (
            <PdfCanvasViewer
              data={blob}
              watermarkLines={watermarkLines}
              forensicCode={forensicCode}
              onRetry={() => setAttempt((n) => n + 1)}
            />
          )}
        </CaptureShield>
      </div>
    </div>
  );
}
