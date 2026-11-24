# accesos-module

**Objetivo:** módulo "Accesos" para admin: pantalla con el registro de quién previsualizó/descargó/compartió resultados, con filtros, paginación y resumen.

**Alcance autorizado:** backend (nueva ruta `/api/accesos`, solo lectura, admin) + frontend (página Accesos, ruta, ítem de menú). Sin cambios de esquema (usa `resultado_accesos`, que ya existe).

## Tareas
- [x] T1: backend `GET /api/accesos` (filtros accion, q, desde, hasta; paginación) y `GET /api/accesos/resumen`, solo admin, SQL parametrizado, con tests.
- [x] T2: frontend página Accesos (resumen, filtros, tabla, paginación, claro/oscuro, responsive) + ruta `/accesos` admin + ítem de menú.
- [x] T3: verificación: 43 tests OK, tsc 0, builds OK; API contra BD real (lista, resumen, filtros, comodines, validación 400, 403 no admin, 401); navegador: página con resumen y tabla, filtros, estado vacío, modo oscuro.

## Progreso / Evidencia
- T1 (inline writer, delegated): backend/src/routes/accesos.ts + mount in index.ts + backend/tests/accesos.test.ts. RED observed (module missing), GREEN: npm test 5 files / 43 tests pass, tsc --noEmit 0 errors, npm run build ok.
- T2: frontend/src/pages/Accesos.tsx, api.ts (getAccesos, getAccesosResumen), route /accesos (admin), sidebar item after Reportes. frontend npm run build ok; oxlint: only pre-existing BarChart3 unused warning.
- T3 pending (browser check against real DB, read-only; deploy).
