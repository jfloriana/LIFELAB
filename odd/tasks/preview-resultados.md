# preview-resultados

**Objetivo:** previsualizar el PDF de resultados (sin salir de la app) para admin, recepcionista, bioanalista (Mis Envios) y paciente (incluida la vista del QR), con protección anti-captura best-effort.

**Alcance autorizado:** solo frontend (`frontend/src/pages/Resultados.tsx`, `frontend/src/pages/MisEnvios.tsx`, `frontend/src/components/qr-modal.tsx`, un componente nuevo `frontend/src/components/PdfPreviewModal.tsx` y, si hace falta, `frontend/src/services/api.ts`). Sin cambios de backend: se reutiliza `GET /resultados/download/:id`.

**Limitación honesta:** un navegador web no puede bloquear capturas de pantalla ni grabación a nivel de SO. Se implementa disuasión best-effort: pantalla negra al perder foco/ocultar pestaña, al pulsar PrintScreen / atajos de captura, al imprimir (@media print), bloqueo de clic derecho / copiar / guardar / imprimir en el visor, y marca de agua con el usuario.

## Tareas
- [x] T1: componente `PdfPreviewModal` (fetch con credenciales -> blob URL -> visor, overlay negro en blur/visibilitychange/PrintScreen/print, marca de agua, sin descarga desde el visor).
- [x] T2: Resultados.tsx: botón "Previsualizar" para admin, recepcionista y paciente.
- [x] T3: MisEnvios.tsx: botón "Previsualizar" para bioanalista.
- [x] T4: qr-modal.tsx y Compartido.tsx: protección anti-captura sobre el QR y la vista pública.
- [ ] T5 (partial: tsc/lint/build done, manual browser test pending): verificación: tsc/lint/build, prueba manual en navegador.

## Verificación
Sin framework de tests en el repo: verificación con `npm run build` + `npm run lint` + prueba manual en navegador (read-only).

## Progreso / Evidencia
Implementation written inline by the writer (route: delegated writer). Observed: `npm run build` OK; `npm run lint` shows only 1 new warning (react-refresh only-export-components in PdfPreviewModal.tsx, hook exported beside components); `npx tsc -b --noEmit` has 10 pre-existing errors in unrelated files and 4 pre-existing `unknown`->ReactNode errors in Compartido.tsx (also present on base); no new type errors. No test framework: RED/GREEN not applicable (UI change).
T5 pending: manual browser check not performed (capture overlay behavior unverified in a real browser). Not committed.
