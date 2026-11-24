# canvas-viewer

**Objetivo:** reemplazar el visor PDF nativo (iframe) por un visor propio con pdf.js sobre canvas para endurecer la protección anti-captura: marca de agua horneada en los píxeles, una página a la vez, cobertura por inactividad, marca de agua forense casi invisible con ID por sesión, y marca de agua visible que cambia de posición.

**Alcance autorizado:** solo frontend: `frontend/src/components/PdfPreviewModal.tsx`, nuevo `frontend/src/components/PdfCanvasViewer.tsx`, `frontend/package.json` + `package-lock.json` (nueva dependencia `pdfjs-dist`), `frontend/src/index.css`, este documento.

**Limitación honesta:** una web no puede bloquear capturas del SO; esto es disuasión + trazabilidad. Bloqueo real requiere app nativa.

## Tareas
- [x] T1: PdfCanvasViewer con pdf.js (render por página en canvas, zoom básico, navegación anterior/siguiente, sin iframe).
- [x] T2: marca de agua visible horneada en el canvas + overlay que cambia de posición cada pocos segundos.
- [x] T3: marca de agua forense casi invisible (ID usuario-resultado-sesión) horneada en el canvas.
- [x] T4: cobertura por inactividad (sin movimiento/toque) y se mantiene hold-to-view táctil y triggers existentes.
- [x] T5: verificación: build/lint/tsc OK; navegador (Chrome): canvas renderiza sin iframe ni errores, marcas horneadas en píxeles, overlay se mueve, cobertura por inactividad a los 20 s, navegación 1->2 páginas, hold-to-view táctil emulado OK. No probado: dispositivos físicos, QR real.

## Progreso / Evidencia
- Impl (delegated writer, uncommitted): pdfjs-dist 5.7.284 (exact, lazy chunk `pdf-*.js` 410 kB + worker asset `pdf.worker.min-*.mjs` 1.2 MB); PdfCanvasViewer.tsx new; PdfPreviewModal.tsx uses it (iframe + top guard removed); CaptureShield gained moving overlay watermark (4 s steps, reduced-motion aware) and opt-in idle cover (20 s).
- T5: tsc adds no errors in our files (10 pre-existing elsewhere); lint no new warnings in our files; vite build OK. Browser test: pending.
