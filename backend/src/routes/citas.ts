import { Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

function validateId(field = "id") {
  return param(field).isInt({ min: 1 }).withMessage(`${field} inválido`);
}

const router = Router();
router.use(authMiddleware);

const DURACION_MIN = 29;
const GAP_MIN = 1;
const SLOT_TOTAL = DURACION_MIN + GAP_MIN;

function generarSlots(fecha: string) {
  const slots: { inicio: string; fin: string }[] = [];
  for (let h = 8; h <= 17; h++) {
    for (let m = 0; m < 60; m += SLOT_TOTAL) {
      if (h === 17 && m > 0) break;
      const inicio = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const finM = m + DURACION_MIN;
      const finH = finM >= 60 ? h + 1 : h;
      const finMin = finM >= 60 ? finM - 60 : finM;
      if (finH > 17) break;
      const fin = `${String(finH).padStart(2, "0")}:${String(finMin).padStart(2, "0")}`;
      slots.push({ inicio, fin });
    }
  }
  return slots;
}

router.get("/slots",
  query("fecha").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Fecha inválida, use YYYY-MM-DD"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const { fecha } = req.query as Record<string, string>;
  const db = getDatabase();
  const todos = generarSlots(fecha);
  const ocupados = await db.exec(
    "SELECT hora_inicio FROM citas WHERE fecha = ? AND estado != 'cancelada'",
    [fecha]
  );
  const ocupSet = new Set(
    (ocupados[0]?.values || []).map((r) => r[0] as string)
  );
  const disponibles = todos.filter((s) => !ocupSet.has(s.inicio));
  res.json({ slots: disponibles });
});

const CITA_COLS = "c.id, c.paciente_id, TO_CHAR(c.fecha, 'YYYY-MM-DD') as fecha, c.hora_inicio, c.hora_fin, c.tipo, c.estado, c.notas, c.registrado_por, c.medico, c.edad, c.idx, c.analisis_solicitados, c.created_at";

router.get("/", async (req, res) => {
  const db = getDatabase();
  const role = req.user!.role;
  let sql: string;
  const params: unknown[] = [];

  const whereClauses: string[] = [];

  if (role === "paciente") {
    whereClauses.push("p.user_id = ?");
    params.push(req.user!.userId);
  }

  if (req.query.fecha) {
    whereClauses.push("c.fecha = ?");
    params.push(req.query.fecha as string);
  }

  const whereStr = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

  if (role === "recepcionista" || role === "admin" || role === "bioanalista") {
    sql = `SELECT ${CITA_COLS}, u.nombre as paciente_nombre, u.apellido as paciente_apellido, u.email as paciente_email, p.fecha_nacimiento
           FROM citas c
           JOIN pacientes p ON p.id = c.paciente_id
           JOIN users u ON u.id = p.user_id
           ${whereStr}
           ORDER BY c.fecha DESC, c.hora_inicio ASC`;
  } else {
    sql = `SELECT ${CITA_COLS}, u.nombre as paciente_nombre, u.apellido as paciente_apellido, p.fecha_nacimiento
           FROM citas c
           JOIN pacientes p ON p.id = c.paciente_id
           JOIN users u ON u.id = p.user_id
           ${whereStr}
           ORDER BY c.fecha DESC, c.hora_inicio ASC`;
  }

  const result = await db.exec(sql, params);
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });

  const citaIds = rows.map((c) => (c as Record<string, unknown>).id as number).filter(Boolean);
  if (citaIds.length > 0) {
    const placeholders = citaIds.map(() => "?").join(",");
    const testsResult = await db.exec(
      `SELECT id, cita_id, test_id, estado FROM analisis WHERE cita_id IN (${placeholders}) ORDER BY id ASC`,
      citaIds
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
          (t: Record<string, unknown>) => t.cita_id === (cita as Record<string, unknown>).id
        );
      }
    }
  }

  res.json(rows);
});

router.post("/",
  body("paciente_id").isInt({ min: 1 }).withMessage("Paciente requerido"),
  body("fecha").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Fecha inválida"),
  body("hora_inicio").matches(/^\d{2}:\d{2}$/).withMessage("Hora inválida"),
  body("idx").trim().isLength({ min: 1, max: 100 }).withMessage("IDX requerido (máx 100)"),
  body("medico").trim().isLength({ min: 1, max: 200 }).withMessage("Bioanalista requerido (máx 200)"),
  body("analisis_solicitados").isArray({ min: 1 }).withMessage("Al menos un análisis"),
  body("notas").optional({ values: "falsy" }).trim().isLength({ max: 2000 }).withMessage("Notas muy largas (máx 2000)"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  if (req.user!.role !== "admin" && req.user!.role !== "recepcionista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }

  const { paciente_id, fecha, hora_inicio, notas, medico, idx, analisis_solicitados } = req.body;
  if (!paciente_id || !fecha || !hora_inicio) {
    res.status(400).json({ error: "paciente_id, fecha y hora_inicio son requeridos" });
    return;
  }
  if (!idx || !idx.trim()) {
    res.status(400).json({ error: "El campo IDX es obligatorio" });
    return;
  }
  if (!medico || !medico.trim()) {
    res.status(400).json({ error: "El campo Bioanalista es obligatorio" });
    return;
  }
  if (!analisis_solicitados || !Array.isArray(analisis_solicitados) || analisis_solicitados.length === 0) {
    res.status(400).json({ error: "Debe seleccionar al menos un análisis" });
    return;
  }
  const db = getDatabase();

  const existente = await db.exec(
    "SELECT id FROM citas WHERE fecha = ? AND hora_inicio = ? AND estado != 'cancelada'",
    [fecha, hora_inicio]
  );
  if (existente.length && existente[0].values.length) {
    res.status(409).json({ error: "Este horario ya está ocupado" });
    return;
  }

  const [h, m] = hora_inicio.split(":").map(Number);
  const finM = m + DURACION_MIN;
  const hora_fin = `${String(finM >= 60 ? h + 1 : h).padStart(2, "0")}:${String(finM >= 60 ? finM - 60 : finM).padStart(2, "0")}`;

  const analisisJson = JSON.stringify(analisis_solicitados || []);

  const insertResult = await db.exec(
    "INSERT INTO citas (paciente_id, fecha, hora_inicio, hora_fin, tipo, notas, registrado_por, medico, idx, analisis_solicitados) VALUES (?, ?, ?, ?, 'analisis', ?, ?, ?, ?, ?) RETURNING id",
    [paciente_id, fecha, hora_inicio, hora_fin, notas || null, req.user!.userId, medico, idx, analisisJson]
  );
  const citaId = insertResult[0].values[0][0] as number;

  if (analisis_solicitados && Array.isArray(analisis_solicitados)) {
    for (const testId of analisis_solicitados) {
      await db.run(
        "INSERT INTO analisis (cita_id, test_id, estado) VALUES (?, ?, 'pendiente')",
        [citaId, testId]
      );
    }
  }

  res.status(201).json({ mensaje: "Cita registrada exitosamente" });
});

router.put("/:id/estado", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin" && req.user!.role !== "recepcionista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const { estado } = req.body;
  if (!["pendiente", "aprobada", "completada", "cancelada"].includes(estado)) {
    res.status(400).json({ error: "Estado inválido" });
    return;
  }
  const db = getDatabase();
  await db.run("UPDATE citas SET estado = ? WHERE id = ?", [estado, req.params!.id]);
  res.json({ mensaje: "Estado actualizado" });
});

router.put("/:id/aprobar", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin" && req.user!.role !== "recepcionista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  const result = await db.exec("SELECT id, estado FROM citas WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Cita no encontrada" }); return;
  }
  if (result[0].values[0][1] !== "pendiente") {
    res.status(409).json({ error: "La cita ya fue procesada" }); return;
  }
  await db.run("UPDATE citas SET estado = 'aprobada' WHERE id = ?", [req.params!.id]);
  res.json({ mensaje: "Cita aprobada exitosamente" });
});

router.put("/:id",
  validateId(),
  body("fecha").matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Fecha inválida"),
  body("hora_inicio").matches(/^\d{2}:\d{2}$/).withMessage("Hora inválida"),
  body("idx").trim().isLength({ min: 1, max: 100 }).withMessage("IDX requerido (máx 100)"),
  body("medico").trim().isLength({ min: 1, max: 200 }).withMessage("Bioanalista requerido (máx 200)"),
  body("analisis_solicitados").isArray({ min: 1 }).withMessage("Al menos un análisis"),
  body("notas").optional({ values: "falsy" }).trim().isLength({ max: 2000 }).withMessage("Notas muy largas (máx 2000)"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const role = req.user!.role;
  if (role !== "admin" && role !== "recepcionista") {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  const id = req.params!.id;
  const { fecha, hora_inicio, notas, medico, idx, analisis_solicitados } = req.body;
  if (!fecha || !hora_inicio) {
    res.status(400).json({ error: "fecha y hora_inicio son requeridos" });
    return;
  }
  if (!idx || !idx.trim()) {
    res.status(400).json({ error: "El campo IDX es obligatorio" });
    return;
  }
  if (!medico || !medico.trim()) {
    res.status(400).json({ error: "El campo Bioanalista es obligatorio" });
    return;
  }
  if (!analisis_solicitados || !Array.isArray(analisis_solicitados) || analisis_solicitados.length === 0) {
    res.status(400).json({ error: "Debe seleccionar al menos un análisis" });
    return;
  }
  const db = getDatabase();

  const existente = await db.exec(
    "SELECT id, hora_inicio FROM citas WHERE fecha = ? AND hora_inicio = ? AND estado != 'cancelada' AND id != ?",
    [fecha, hora_inicio, id]
  );
  if (existente.length && existente[0].values.length) {
    res.status(409).json({ error: "Este horario ya está ocupado" });
    return;
  }

  const [h, m] = hora_inicio.split(":").map(Number);
  const finM = m + DURACION_MIN;
  const hora_fin = `${String(finM >= 60 ? h + 1 : h).padStart(2, "0")}:${String(finM >= 60 ? finM - 60 : finM).padStart(2, "0")}`;

  await db.run(
    "UPDATE citas SET fecha = ?, hora_inicio = ?, hora_fin = ?, notas = ?, medico = ?, idx = ? WHERE id = ?",
    [fecha, hora_inicio, hora_fin, notas || null, medico, idx, id]
  );

  // Re-sync analisis: delete existing, insert new
  await db.run("DELETE FROM analisis WHERE cita_id = ?", [id]);
  for (const testId of analisis_solicitados) {
    await db.run(
      "INSERT INTO analisis (cita_id, test_id, estado) VALUES (?, ?, 'pendiente')",
      [id, testId]
    );
  }

  res.json({ mensaje: "Cita actualizada exitosamente" });
});

router.delete("/:id", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Solo administradores pueden eliminar citas" });
    return;
  }
  const db = getDatabase();
  // Check if cita has resultados
  const hasResult = await db.exec("SELECT id FROM resultados WHERE cita_id = ? LIMIT 1", [req.params!.id]);
  if (hasResult.length && hasResult[0].values.length) {
    res.status(409).json({ error: "No se puede eliminar una cita que tiene resultados asociados. Elimine los resultados primero." });
    return;
  }
  await db.run("DELETE FROM analisis WHERE cita_id = ?", [req.params!.id]);
  await db.run("DELETE FROM citas WHERE id = ?", [req.params!.id]);
  res.json({ mensaje: "Cita eliminada exitosamente" });
});

router.get("/con-idx/:pacienteId", validateId("pacienteId"), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const role = req.user!.role;
  if (role !== "admin" && role !== "recepcionista" && role !== "bioanalista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  let sql = `
    SELECT c.id as cita_id, c.idx, TO_CHAR(c.fecha, 'YYYY-MM-DD') as fecha, c.hora_inicio
    FROM citas c
    JOIN analisis a ON a.cita_id = c.id
    WHERE c.paciente_id = ?
      AND c.idx != ''
      AND c.id NOT IN (SELECT cita_id FROM resultados WHERE cita_id IS NOT NULL AND estado = 'aprobado')
  `;
  const params: unknown[] = [req.params!.pacienteId];

  if (role === "bioanalista") {
    const bioName = `${req.user!.nombre} ${req.user!.apellido}`;
    sql += ` AND c.medico = ?`;
    params.push(bioName);
  }

  sql += `
    GROUP BY c.id, c.idx, c.fecha, c.hora_inicio
    HAVING SUM(CASE WHEN a.estado = 'completado' THEN 1 ELSE 0 END) > 0
    ORDER BY c.fecha DESC, c.hora_inicio ASC
  `;
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

router.put("/analisis/:analisisId/estado",
  param("analisisId").isInt({ min: 1 }).withMessage("analisisId inválido"),
  body("estado").isIn(["pendiente", "en_proceso", "completado"]).withMessage("Estado inválido"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (!req.user || !["admin", "bioanalista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  const analisisId = parseInt(req.params!.analisisId);
  const { estado } = req.body;

  const analisis = await db.exec(
    `SELECT a.id, a.cita_id, c.medico FROM analisis a JOIN citas c ON c.id = a.cita_id WHERE a.id = ?`,
    [analisisId]
  );
  if (!analisis.length || !analisis[0].values.length) {
    res.status(404).json({ error: "Análisis no encontrado" }); return;
  }
  const row = analisis[0].values[0];
  const cols = analisis[0].columns;
  const analisisData: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { analisisData[col] = row[i]; });

  if (req.user.role === "bioanalista") {
    const bioName = `${req.user.nombre} ${req.user.apellido}`;
    if (analisisData.medico !== bioName) {
      res.status(403).json({ error: "Solo puedes modificar análisis de tus citas asignadas" }); return;
    }
  }

  await db.run("UPDATE analisis SET estado = ? WHERE id = ?", [estado, analisisId]);

  const citaId = analisisData.cita_id as number;
  const testsResult = await db.exec(
    "SELECT estado FROM analisis WHERE cita_id = ?",
    [citaId]
  );
  const estados = (testsResult[0]?.values || []).map((r: unknown[]) => r[0] as string);
  if (estados.some((e: string) => e === "en_proceso")) {
    await db.run("UPDATE citas SET estado = 'en_proceso' WHERE id = ?", [citaId]);
  }

  res.json({ mensaje: "Estado del análisis actualizado" });
});

export default router;
