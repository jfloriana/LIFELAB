# qr-dinamico

**Objetivo:** QR de un solo uso que se renueva solo, con límite de generación y desbloqueo manual del admin.

**Reglas acordadas con el usuario:**
- Previsualizar con un QR lo **consume** (el enlace queda inválido). Escanearlo de nuevo muestra "Este código ya fue usado. Pide uno nuevo." Solo escanear sin previsualizar NO lo consume.
- La ventana del QR del paciente detecta que se usó y muestra un **QR nuevo automáticamente**.
- Límite: **5 QR generados cada 2 horas por resultado** (cada generación cuenta, se use o no). Al llegar al límite no se generan más y se muestra "Alcanzaste el límite de códigos QR. Inténtalo de nuevo en X minutos."
- El admin NO es ilimitado: sigue el mismo límite. Puede **desbloquear manualmente** un resultado (reinicia el contador), registrado con su identidad.
- Todo queda en Accesos (generados, usados, rechazados, desbloqueos).

## Tareas
- [x] T1: backend: consumo del token al previsualizar; 410 QR_USED en GET meta; límite 5/2h en compartir (429 QR_LIMIT con reintento); endpoint estado; desbloqueo admin; acciones nuevas en log; tests.
- [x] T2: frontend qr-modal: contador, polling, auto-renovación, mensaje de límite con cuenta regresiva; Compartido: mensaje QR usado.
- [x] T3: módulo Accesos: lista de QR bloqueados + botón Desbloquear; nuevas acciones en filtros/etiquetas.
- [x] T4: verificación: 100 tests OK, tsc 0, builds OK; BD real: 429 QR_LIMIT, admin también limitado, desbloqueo reinicia contador, 410 QR_USED al reescanear, escaneo sin previsualizar no consume; navegador: ventana QR con contador, auto-renovación al usarse, panel QR bloqueados con confirmación; texto genérico de código inválido aclarado.

## Progreso / Evidencia
- T1: backend npm test 100/100 pass (7 files), tsc 0 errors, npm run build ok. New tests in backend/tests/qr-limit.test.ts; compartido-preview.test.ts updated (consume-on-preview).
- T2/T3: frontend npm run build ok, oxlint on touched files clean. Not exercised in a browser (pending in T4).
- Extra: index idx_resultado_accesos_resultado_accion added (additive, IF NOT EXISTS). Commits: none (writer does not commit).
