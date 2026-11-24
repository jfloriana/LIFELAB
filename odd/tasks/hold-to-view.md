# hold-to-view

**Objetivo:** en dispositivos táctiles (celular/tablet) el documento y el QR permanecen tapados y solo se ven mientras se mantiene presionado un botón; marca de agua más fuerte (nombre, correo, fecha/hora). PC/laptop conservan el comportamiento actual.

**Alcance autorizado:** frontend only: `frontend/src/components/PdfPreviewModal.tsx`, `frontend/src/components/qr-modal.tsx`, `frontend/src/index.css`, este documento. Sin backend.

**Limitación honesta:** una web no puede detectar ni bloquear capturas en iOS/Android; esto es disuasión + trazabilidad (marca de agua). Bloqueo real requiere app nativa (FLAG_SECURE).

## Tareas
- [x] T1: detección táctil (`matchMedia('(pointer: coarse)')` evaluada al montar) + modo hold-to-view en CaptureShield.
- [x] T2: PdfPreviewModal y qr-modal usan hold-to-view en táctil.
- [x] T3: marca de agua más densa con nombre, correo y fecha/hora.
- [x] T4: verificación (build OK; prueba en navegador con matchMedia coarse emulado: cubierto por defecto, visible al mantener, cubierto al soltar/cancelar/contextmenu; en PC sin barra y visible; marca de agua con nombre, correo y año). No probado: QR real (crea enlace en BD), dispositivos físicos iOS/Android.

## Progreso / Evidencia
T1-T3: implemented in PdfPreviewModal.tsx (CaptureShield holdToView, useIsTouch, denser watermark), qr-modal.tsx, index.css. tsc: 10 errors, none in touched files; lint: no new warnings; build OK. T4 browser test pending (parent).
