# qr-escaneo-unico

**Objetivo:** el QR muere en el PRIMER escaneo (carga de /compartido/:token), no al previsualizar. Si alguien captura la imagen del QR, un segundo escaneo no sirve.

**Reglas (acordadas con el usuario):**
- Primer GET /api/compartido/:token marca el token como escaneado (atómico) y emite una **sesión de escaneo** (ticket, 10 min) que habilita **1 previsualización y 1 descarga**.
- Cualquier GET posterior del mismo token -> 410 QR_USED ("Este código ya fue usado. Pide uno nuevo.").
- Previsualizar y descargar exigen una sesión válida; el token solo (sin ticket) ya no da acceso al PDF.
- La ventana del QR del paciente se renueva en cuanto se escanea (estado.activo=false). Cada escaneo cuenta como uno de los 5 QR/2 h.
- Recargar la página tras el primer escaneo da 410 (comportamiento aceptado).

## Tareas
- [x] T1: backend: columna aditiva `resultados.compartido_escaneado_at`; GET atómico; sesión con 1 preview + 1 descarga; descarga y preview exigen ticket; estado.activo = no escaneado y no vencido; tests.
- [x] T2: frontend: Compartido sin doble fetch (dev StrictMode), descarga con ticket, manejo 410; qr-modal mensaje "El código anterior fue escaneado".
- [x] T3: verificación: 111 tests OK, tsc 0, builds OK; BD real: 1er escaneo da sesión, 2do escaneo 410 QR_USED, token solo no previsualiza ni descarga, 1 preview y 1 descarga por sesión, estado activo=false tras escanear; navegador: ventana QR se renueva al escanear sin previsualizar, 1 sola petición API por carga, recarga muestra Código ya usado.

## Progreso / Evidencia
T1: backend npm test 111/111 passed, tsc 0 errors, build ok. T2: frontend build ok, oxlint clean on touched files. Route: delegated writer (2+ non-trivial files). Commit identity: pending (parent commits). T3 pending.
