# qr-single-preview

**Objetivo:** en la página pública del QR (`/compartido/:token`) agregar un botón "Previsualizar" que permita ver el documento **una sola vez por escaneo**. Un segundo intento muestra "Ya previsualizaste este documento. Vuelve a escanear el código QR". Al volver a escanear (nueva carga de la página) se otorga otra previsualización.

**Diseño:** cada carga de `GET /api/compartido/:token` emite un ticket de un solo uso (UUID, TTL 10 min, guardado en tabla `compartido_vistas`). `POST /api/compartido/:token/previsualizar` con el ticket lo consume atómicamente y devuelve el PDF; 410 si ya usado/vencido. Se registra en `resultado_accesos` como `previsualizacion_compartida`.

**Alcance:** backend (compartido.ts, database.ts tabla nueva aditiva, accesos.ts acción permitida) + frontend (Compartido.tsx, PdfPreviewModal con loader opcional, api.ts, etiqueta en Accesos.tsx). Sin cambios destructivos.

## Tareas
- [x] T1: backend ticket + endpoint previsualizar (atómico, 410, log) + tests.
- [x] T2: frontend botón Previsualizar en Compartido con visor protegido, mensaje de reescaneo, sin reintento tras 410.
- [x] T3: acción `previsualizacion_compartida` en módulo Accesos (validador, filtro, etiqueta).
- [x] T4: verificación: 64 tests OK, tsc 0, builds OK; API real: 1a previsualización 200, 2a con mismo ticket 410, ticket falso 410, token sigue vigente, re-escaneo 200, registros en Accesos; navegador: botón pasa a "Ya previsualizado", un solo POST, recarga lo habilita; corregido Invalid Date en Compartido.

## Progreso / Evidencia
- T1: backend tests 64/64 (new tests/compartido-preview.test.ts: 17 cases incl. SQL-level atomicity), tsc 0 errors, build OK. RED not observed first (implementation written before tests).
- T2: frontend build OK; oxlint shows 1 new warning (react-hooks/exhaustive-deps on loadBlob in PdfPreviewModal, intentional).
- T3: accesos tests updated and passing; Accesos.tsx label/color/filter added.
- Commits: pending (writer does not commit).
