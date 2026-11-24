import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, RefreshCw, ZoomIn, ZoomOut } from "lucide-react";

/**
 * Own PDF viewer rendered with pdf.js on a <canvas> (one page at a time).
 *
 * Why a canvas instead of the browser's native viewer in an <iframe>: the page
 * pixels and the watermarks below are painted into the SAME bitmap, so hiding
 * or deleting a DOM layer cannot strip them, there is no text layer (nothing to
 * select/copy) and no native toolbar with download/print buttons.
 *
 * HONEST LIMITATION: a web page can NOT block OS-level screenshots, screen
 * recording or a phone camera. Everything here is best-effort deterrence plus
 * traceability (visible + forensic watermarks), never real prevention.
 */

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/** Lazy-load pdf.js (separate chunk, not part of the main bundle) and wire its worker. */
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return mod;
    });
    // Allow a retry if the chunk failed to load (e.g. flaky network).
    pdfjsPromise.catch(() => { pdfjsPromise = null; });
  }
  return pdfjsPromise;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;
/** Hard cap on canvas pixels so huge zoom levels cannot exhaust GPU/memory. */
const MAX_CANVAS_PIXELS = 24_000_000;

/**
 * Paints both watermarks on the already-rendered page (canvas pixel space).
 *
 * 1) Visible: rotated (-20 deg), semi-transparent identity + timestamp pattern.
 * 2) Forensic: a near-invisible dense tiling of `forensicCode`
 *    (LL-<userId>-<resultadoId>-<sessionStamp base36>) at alpha ~0.03.
 *    HOW TO RECOVER IT from a leaked screenshot/photo: open the image in any
 *    editor, apply a strong contrast/levels/curves boost (or threshold) on a
 *    flat white region of the page; the repeating code string emerges as faint
 *    text. Decode the userId / resultadoId and the base36 session stamp
 *    (Date.now() in base36) to identify who viewed it and when.
 */
function drawWatermarks(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  dpr: number,
  lines: string[],
  forensicCode: string
) {
  const reach = Math.hypot(w, h) / 2 + 40 * dpr;

  // --- Visible watermark ---
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate((-20 * Math.PI) / 180);
  ctx.globalAlpha = 0.17;
  ctx.fillStyle = "#6b7280";
  ctx.font = `600 ${13 * dpr}px sans-serif`;
  ctx.textBaseline = "alphabetic";
  const widest = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  const stepX = widest + 70 * dpr;
  const stepY = (lines.length * 17 + 70) * dpr;
  let row = 0;
  for (let y = -reach; y <= reach; y += stepY, row++) {
    const shift = row % 2 ? stepX / 2 : 0;
    for (let x = -reach + shift; x <= reach; x += stepX) {
      lines.forEach((line, i) => ctx.fillText(line, x, y + i * 17 * dpr));
    }
  }
  ctx.restore();

  // --- Forensic watermark ---
  ctx.save();
  ctx.globalAlpha = 0.03;
  ctx.fillStyle = "#000000";
  ctx.font = `${9 * dpr}px monospace`;
  const codeW = ctx.measureText(forensicCode).width + 12 * dpr;
  const rowH = 20 * dpr;
  let r = 0;
  for (let y = rowH; y < h + rowH; y += rowH, r++) {
    const shift = r % 2 ? codeW / 2 : 0;
    for (let x = -shift; x < w; x += codeW) ctx.fillText(forensicCode, x, y);
  }
  ctx.restore();
}

interface PdfCanvasViewerProps {
  /** PDF bytes as downloaded by fetchResultadoBlob. */
  data: Blob;
  /** Lines of the baked-in visible watermark (e.g. name + email, date/time). */
  watermarkLines: string[];
  /** Near-invisible forensic code baked into every rendered page. */
  forensicCode: string;
  /** Called when the user presses "Reintentar" after a load/render error. */
  onRetry: () => void;
}

export function PdfCanvasViewer({ data, watermarkLines, forensicCode, onRetry }: PdfCanvasViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageNum, setPageNum] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [boxWidth, setBoxWidth] = useState(0);

  // Load the document; destroy it (and free its worker memory) on unmount/change.
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    setLoading(true);
    setError(false);
    setPdf(null);
    setPageNum(1);
    (async () => {
      try {
        const [pdfjs, bytes] = await Promise.all([loadPdfJs(), data.arrayBuffer()]);
        if (cancelled) return;
        const loadingTask = pdfjs.getDocument({
          data: new Uint8Array(bytes),
          enableXfa: false,
        });
        task = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) { void loadingTask.destroy(); return; }
        setPdf(doc);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (task) void task.destroy().catch(() => {});
    };
  }, [data]);

  // Free the canvas bitmap on unmount (the element is removed by React; this drops its backing store early).
  useEffect(() => {
    const canvas = canvasRef.current;
    return () => { if (canvas) { canvas.width = 0; canvas.height = 0; } };
  }, [pdf]);

  // Track the available width for fit-to-width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => setBoxWidth(Math.round(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pdf]);

  // Render the current page + bake the watermarks into the same canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!pdf || !canvas || boxWidth <= 0) return;
    let cancelled = false;
    let renderTask: RenderTask | null = null;
    (async () => {
      try {
        const page = await pdf.getPage(pageNum);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const fit = Math.max(120, boxWidth - 24) / base.width;
        const cssScale = fit * zoom;
        let dpr = Math.min(window.devicePixelRatio || 1, 3);
        const pixels = base.width * base.height * cssScale * cssScale * dpr * dpr;
        if (pixels > MAX_CANVAS_PIXELS) dpr *= Math.sqrt(MAX_CANVAS_PIXELS / pixels);
        const viewport = page.getViewport({ scale: cssScale * dpr });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("no 2d context");
        renderTask = page.render({ canvas, canvasContext: ctx, viewport });
        await renderTask.promise;
        if (cancelled) return;
        drawWatermarks(ctx, canvas.width, canvas.height, dpr, watermarkLines, forensicCode);
        page.cleanup();
      } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        if (name === "RenderingCancelledException" || cancelled) return;
        setError(true);
      }
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdf, pageNum, zoom, boxWidth, watermarkLines, forensicCode]);

  const total = pdf?.numPages ?? 0;
  const goto = (n: number) => {
    setPageNum(Math.min(Math.max(1, n), Math.max(1, total)));
    scrollRef.current?.scrollTo({ top: 0 });
  };
  const btn =
    "p-1.5 rounded-md text-gray-600 dark:text-white/70 hover:bg-gray-200 dark:hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent transition-colors";

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
        <p className="text-sm text-red-500">No se pudo cargar el documento</p>
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-white/10 text-sm text-gray-700 dark:text-white/70 hover:bg-gray-100 dark:hover:bg-white/5"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (loading || !pdf) {
    return (
      <div className="absolute inset-0 flex items-center justify-center gap-2 text-gray-500 dark:text-white/40">
        <RefreshCw size={18} className="animate-spin" />
        <span className="text-sm">Cargando documento...</span>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Toolbar sits above (not over) the canvas area. No download/print controls. */}
      <div className="flex items-center justify-between gap-2 px-3 h-11 shrink-0 border-b border-gray-200 dark:border-white/10 bg-white/80 dark:bg-gray-900/80">
        <div className="flex items-center gap-1">
          <button className={btn} onClick={() => goto(pageNum - 1)} disabled={pageNum <= 1} aria-label="Página anterior" title="Página anterior">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm tabular-nums text-gray-700 dark:text-white/70 min-w-24 text-center">
            Página {pageNum} / {total}
          </span>
          <button className={btn} onClick={() => goto(pageNum + 1)} disabled={pageNum >= total} aria-label="Página siguiente" title="Página siguiente">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button className={btn} onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - ZOOM_STEP))} disabled={zoom <= ZOOM_MIN} aria-label="Alejar" title="Alejar">
            <ZoomOut size={18} />
          </button>
          <span className="text-xs tabular-nums text-gray-500 dark:text-white/50 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button className={btn} onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + ZOOM_STEP))} disabled={zoom >= ZOOM_MAX} aria-label="Acercar" title="Acercar">
            <ZoomIn size={18} />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-auto">
        <div className="w-max min-w-full flex justify-center p-3">
          <canvas
            ref={canvasRef}
            className="block shadow-md bg-white select-none"
            style={{ WebkitTouchCallout: "none" }}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>
      </div>
    </div>
  );
}
