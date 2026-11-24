# hardening-2

**Objetivo:** endurecer backend y trazabilidad: sesión que falla cerrada, seed sin contraseñas en código, registro de accesos a resultados, tests automáticos, y limpieza menor.

**Alcance autorizado:** backend + 1 retoque de frontend (api.ts param, qr-modal padding). Sin cambios de esquema destructivos (solo CREATE TABLE IF NOT EXISTS).

## Tareas
- [x] T1: authMiddleware falla cerrado si la BD no responde (503) en vez de dejar pasar.
- [x] T2: seed sin contraseñas en código: solo crea admin si existen SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD; ya no siembra los otros 3 usuarios.
- [x] T3: tabla resultado_accesos + registro de previsualizar/descargar/compartir (best-effort, nunca rompe la descarga) + GET /resultados/:id/accesos solo admin.
- [x] T4: tests (vitest + supertest) de permisos por rol, fail-closed y registro de accesos, con BD mockeada.
- [x] T5: limpieza: texto de log de email, borrar backend/check_db.cjs, .env.example, qr-modal padding inferior en táctil.
- [x] T6: verificación: 25 tests OK, tsc 0 errores, builds OK; prueba local contra BD real: logins/lecturas 200, paciente ajeno 403, accesos admin 200 y 403 para paciente/recepcionista, registro de previsualizar/descarga OK.

## Progreso / Evidencia
- T1-T5 implementadas (sin commit): `npm test` 25/25 pasan (vitest, pool threads), `tsc --noEmit` y `npm run build` OK, frontend build OK, oxlint sin warnings nuevos.
- RED observado en T1 (test 503 falla contra auth.ts original: 200 en vez de 503). T2/T3/T5 sin RED previo (seed de arranque y logging verificados por tests de rutas/typecheck).
- T6 pendiente.
