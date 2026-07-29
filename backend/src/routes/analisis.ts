import { Router } from "express";
import { param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

function validateId(field = "id") {
  return param(field).isInt({ min: 1 }).withMessage(`${field} inválido`);
}

const router = Router();
router.use(authMiddleware);

router.get("/cita/:citaId", validateId("citaId"), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const role = req.user!.role;
  if (role !== "admin" && role !== "bioanalista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  let sql = "SELECT a.* FROM analisis a JOIN citas c ON c.id = a.cita_id WHERE a.cita_id = ?";
  const params: unknown[] = [req.params!.citaId];

  if (role === "bioanalista") {
    const bioName = `${req.user!.nombre} ${req.user!.apellido}`;
    sql += " AND c.medico = ?";
    params.push(bioName);
  }

  sql += " ORDER BY a.id ASC";
  const result = await db.exec(sql, params);
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(rows);
});

router.get("/pendientes", async (req, res) => {
  if (req.user!.role !== "admin" && req.user!.role !== "bioanalista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();

  let sql = `
    SELECT c.id as cita_id, c.fecha, c.hora_inicio, c.hora_fin, c.medico, c.idx,
           c.analisis_solicitados, c.paciente_id,
           u.nombre as paciente_nombre, u.apellido as paciente_apellido, u.email as paciente_email,
           p.fecha_nacimiento,
           CASE
             WHEN SUM(CASE WHEN a.estado = 'en_proceso' THEN 1 ELSE 0 END) > 0 THEN 'en_proceso'
             WHEN SUM(CASE WHEN a.estado = 'pendiente' THEN 1 ELSE 0 END) > 0 THEN 'pendiente'
             ELSE 'completado'
           END as estado
    FROM citas c
    JOIN pacientes p ON p.id = c.paciente_id
    JOIN users u ON u.id = p.user_id
    JOIN analisis a ON a.cita_id = c.id
    WHERE c.id IN (SELECT DISTINCT cita_id FROM analisis WHERE estado IN ('pendiente', 'en_proceso'))
  `;
  const params: unknown[] = [];

  if (req.user!.role === "bioanalista") {
    const bioName = `${req.user!.nombre} ${req.user!.apellido}`;
    sql += " AND c.medico = ?";
    params.push(bioName);
  }

  sql += `
    GROUP BY c.id, c.fecha, c.hora_inicio, c.hora_fin, c.medico, c.idx, c.analisis_solicitados, c.paciente_id,
             u.nombre, u.apellido, u.email, p.fecha_nacimiento
    ORDER BY c.id ASC
  `;

  const citasResult = await db.exec(sql, params);

  if (!citasResult.length) { res.json([]); return; }

  const citasCols = citasResult[0].columns;
  const citas = citasResult[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    citasCols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });

  const citaIds = citas.map((c) => c.cita_id).filter(Boolean) as number[];
  if (citaIds.length > 0) {
    const placeholders = citaIds.map(() => "?").join(",");
    const testsResult = await db.exec(
      `SELECT id, cita_id, test_id, estado FROM analisis WHERE cita_id IN (${placeholders}) ORDER BY id ASC`,
      citaIds as unknown[]
    );
    if (testsResult.length) {
      const testCols = testsResult[0].columns;
      const tests = testsResult[0].values.map((row) => {
        const obj: Record<string, unknown> = {};
        testCols.forEach((col: string, i: number) => { obj[col] = row[i]; });
        return obj;
      });

      for (const cita of citas) {
        (cita as Record<string, unknown>).tests = tests.filter(
          (t: Record<string, unknown>) => t.cita_id === cita.cita_id
        );
      }
    }
  }

  res.json(citas);
});

router.get("/mis-analisis", async (req, res) => {
  const db = getDatabase();
  const result = await db.exec(`
    SELECT c.id as cita_id, c.fecha, c.hora_inicio, c.hora_fin, c.medico, c.idx,
           c.analisis_solicitados,
           CASE
             WHEN SUM(CASE WHEN a.estado = 'en_proceso' THEN 1 ELSE 0 END) > 0 THEN 'en_proceso'
             WHEN SUM(CASE WHEN a.estado = 'pendiente' THEN 1 ELSE 0 END) > 0 THEN 'pendiente'
             ELSE 'completado'
           END as estado
    FROM analisis a
    JOIN citas c ON c.id = a.cita_id
    JOIN pacientes p ON p.id = c.paciente_id
    WHERE p.user_id = ?
    GROUP BY c.id, c.fecha, c.hora_inicio, c.hora_fin, c.medico, c.idx, c.analisis_solicitados
    ORDER BY c.id ASC
  `, [req.user!.userId]);
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });

  const citaIds = rows.map((c) => c.cita_id).filter(Boolean) as number[];
  if (citaIds.length > 0) {
    const placeholders = citaIds.map(() => "?").join(",");
    const testsResult = await db.exec(
      `SELECT id, cita_id, test_id, estado FROM analisis WHERE cita_id IN (${placeholders}) ORDER BY id ASC`,
      citaIds as unknown[]
    );
    if (testsResult.length) {
      const testCols = testsResult[0].columns;
      const tests = testsResult[0].values.map((row) => {
        const obj: Record<string, unknown> = {};
        testCols.forEach((col: string, i: number) => { obj[col] = row[i]; });
        return obj;
      });

      for (const cita of rows) {
        (cita as Record<string, unknown>).tests = tests.filter(
          (t: Record<string, unknown>) => t.cita_id === cita.cita_id
        );
      }
    }
  }

  res.json(rows);
});

router.put("/:id/estado", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin" && req.user!.role !== "bioanalista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const { estado } = req.body;
  if (!["pendiente", "en_proceso", "completado"].includes(estado)) {
    res.status(400).json({ error: "Estado inválido. Use: pendiente, en_proceso, completado" });
    return;
  }
  const db = getDatabase();
  await db.run("UPDATE analisis SET estado = ? WHERE id = ?", [estado, req.params!.id]);
  res.json({ mensaje: "Estado actualizado" });
});

export default router;
