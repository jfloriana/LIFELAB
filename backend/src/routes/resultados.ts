import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

function validateId(field = "id") {
  return param(field).isInt({ min: 1 }).withMessage(`${field} inválido`);
}

function isValidPdf(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(8);
    fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    return /^%PDF-1\.\d/.test(buffer.toString("ascii", 0, 8));
  } catch {
    return false;
  }
}

const router = Router();
router.use(authMiddleware);

const UPLOAD_DIR = path.resolve("./uploads/resultados");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const unique = crypto.randomUUID();
    cb(null, unique + "-" + safeName);
  },
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos PDF"));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

router.get("/", async (req, res) => {
  const db = getDatabase();
  const role = req.user!.role;
  let sql: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: unknown[] = [];

  if (role === "paciente") {
    sql = `SELECT r.*, u.nombre as subido_por_nombre, u.apellido as subido_por_apellido,
                  TO_CHAR(c.fecha, 'YYYY-MM-DD') as cita_fecha, c.hora_inicio as cita_hora_inicio, c.hora_fin as cita_hora_fin, c.medico as cita_medico, c.idx as cita_idx,
                  (SELECT json_agg(json_build_object('id', a.id, 'test_id', a.test_id, 'estado', a.estado)) FROM analisis a WHERE a.cita_id = r.cita_id) as cita_tests
           FROM resultados r
           JOIN pacientes p ON p.id = r.paciente_id
           JOIN users u ON u.id = r.subido_por
           LEFT JOIN citas c ON c.id = r.cita_id
           WHERE p.user_id = ? AND r.estado = 'aprobado'
           ORDER BY r.created_at DESC`;
    params.push(req.user!.userId);
  } else if (role === "admin") {
    sql = `SELECT r.*, u.nombre as subido_por_nombre, u.apellido as subido_por_apellido,
                  pu.nombre as paciente_nombre, pu.apellido as paciente_apellido,
                  TO_CHAR(c.fecha, 'YYYY-MM-DD') as cita_fecha, c.hora_inicio as cita_hora_inicio, c.hora_fin as cita_hora_fin, c.medico as cita_medico, c.idx as cita_idx,
                  (SELECT json_agg(json_build_object('id', a.id, 'test_id', a.test_id, 'estado', a.estado)) FROM analisis a WHERE a.cita_id = r.cita_id) as cita_tests
           FROM resultados r
           JOIN pacientes p ON p.id = r.paciente_id
           JOIN users pu ON pu.id = p.user_id
           JOIN users u ON u.id = r.subido_por
           LEFT JOIN citas c ON c.id = r.cita_id
           ORDER BY r.created_at DESC`;
  } else {
    sql = `SELECT r.*, pu.nombre as paciente_nombre, pu.apellido as paciente_apellido,
                  TO_CHAR(c.fecha, 'YYYY-MM-DD') as cita_fecha, c.hora_inicio as cita_hora_inicio, c.hora_fin as cita_hora_fin, c.medico as cita_medico, c.idx as cita_idx,
                  (SELECT json_agg(json_build_object('id', a.id, 'test_id', a.test_id, 'estado', a.estado)) FROM analisis a WHERE a.cita_id = r.cita_id) as cita_tests
           FROM resultados r
           JOIN pacientes p ON p.id = r.paciente_id
           JOIN users pu ON pu.id = p.user_id
           LEFT JOIN citas c ON c.id = r.cita_id
           ORDER BY r.created_at DESC`;
  }

  const result = await db.exec(sql, params);
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => {
      obj[col] = row[i];
      if (col === "cita_tests" && typeof row[i] === "string") {
        try { obj[col] = JSON.parse(row[i] as string); } catch { obj[col] = []; }
      }
    });
    return obj;
  });
  res.json(rows);
});

const TIPOS_VALIDOS = ["analisis", "imagen", "documento"];

router.post("/upload",
  upload.single("archivo"),
  body("tipo").optional({ values: "falsy" }).isIn(TIPOS_VALIDOS).withMessage("Tipo inválido"),
  body("paciente_id").isInt({ min: 1 }).withMessage("Paciente requerido"),
  body("titulo").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 200 }).withMessage("Título inválido"),
  body("cita_id").optional({ values: "falsy" }).isInt({ min: 1 }).withMessage("Cita inválida"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); res.status(400).json({ error: errors.array()[0].msg }); return; }

  const role = req.user!.role;
  if (role !== "bioanalista") {
    res.status(403).json({ error: "Solo bioanalistas pueden subir resultados" }); return;
  }

  const { paciente_id, tipo, titulo, cita_id } = req.body;
  if (!paciente_id || !req.file) {
    res.status(400).json({ error: "paciente_id y archivo son requeridos" });
    return;
  }

  const db = getDatabase();

  if (role === "bioanalista" && cita_id) {
    const citas = await db.exec(
      "SELECT id, medico FROM citas WHERE id = ? AND paciente_id = ?",
      [cita_id, paciente_id]
    );
    if (!citas.length || !citas[0].values.length) {
      fs.unlinkSync(req.file.path);
      res.status(403).json({ error: "No tienes acceso a esta cita" });
      return;
    }
    const cols = citas[0].columns;
    const row = citas[0].values[0];
    const cita: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { cita[col] = row[i]; });
    const bioName = `${req.user!.nombre} ${req.user!.apellido}`;
    if (cita.medico !== bioName) {
      fs.unlinkSync(req.file.path);
      res.status(403).json({ error: "No estás asignado como bioanalista de esta cita" });
      return;
    }
  }

  if (!isValidPdf(req.file.path)) {
    fs.unlinkSync(req.file.path);
    res.status(400).json({ error: "El archivo no es un PDF válido" });
    return;
  }

  await db.run(
    `INSERT INTO resultados (paciente_id, subido_por, tipo, titulo, archivo_nombre, archivo_path, cita_id, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')`,
    [paciente_id, req.user!.userId, tipo || "analisis", titulo || "Resultado", req.file.filename, req.file.path, cita_id || null]
  );
  res.status(201).json({ mensaje: "Resultado subido exitosamente" });
});

router.get("/download/:id", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const db = getDatabase();
  const result = await db.exec("SELECT * FROM resultados WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado" });
    return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const r: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { r[col] = row[i]; });

  const allowedRoles = ["admin", "recepcionista", "bioanalista"];
  const isStaff = req.user && allowedRoles.includes(req.user.role);
  let isOwner = false;
  if (req.user && r.paciente_id) {
    const ownerRes = await db.exec("SELECT user_id FROM pacientes WHERE id = ?", [r.paciente_id]);
    isOwner = ownerRes.length > 0 && ownerRes[0].values[0][0] === req.user.userId;
  }
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: "No autorizado" }); return;
  }

  if (!fs.existsSync(r.archivo_path as string)) {
    res.status(404).json({ error: "Archivo no encontrado en el servidor" });
    return;
  }
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.download(r.archivo_path as string, r.archivo_nombre as string);
});

router.post("/:id/compartir", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const db = getDatabase();
  const result = await db.exec("SELECT * FROM resultados WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado" }); return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const r: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { r[col] = row[i]; });

  const isStaff = ["admin", "recepcionista", "bioanalista"].includes(req.user!.role);
  let isOwner = false;
  if (r.paciente_id) {
    const ownerRes = await db.exec("SELECT user_id FROM pacientes WHERE id = ?", [r.paciente_id]);
    isOwner = ownerRes.length > 0 && ownerRes[0].values[0][0] === req.user!.userId;
  }
  if (!isStaff && !isOwner) {
    res.status(403).json({ error: "No autorizado" }); return;
  }

  // Always generate a new token (expire old one if exists)
  const token = crypto.randomUUID();
  await db.run(
    "UPDATE resultados SET compartido_token = ?, compartido_expira = NOW() + INTERVAL '7 days' WHERE id = ?",
    [token, req.params!.id]
  );
  const publicUrl = process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`;
  const shareUrl = `${publicUrl}/compartido/${token}`;
  res.json({ token, url: shareUrl });
});

router.put("/:id",
  validateId(),
  body("titulo").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 200 }).withMessage("Título inválido (máx 200 caracteres)"),
  body("tipo").optional({ values: "falsy" }).isIn(TIPOS_VALIDOS).withMessage("Tipo inválido"),
  upload.single("archivo"), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const db = getDatabase();
  const result = await db.exec("SELECT * FROM resultados WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado" }); return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const r: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { r[col] = row[i]; });

  const role = req.user!.role;
  if (role !== "admin" && role !== "bioanalista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }

  if (role === "bioanalista" && r.subido_por !== req.user!.userId) {
    res.status(403).json({ error: "Solo puedes modificar tus propios resultados" }); return;
  }

  let archivo_nombre = r.archivo_nombre as string;
  let archivo_path = r.archivo_path as string;

  if (req.file) {
    if (!isValidPdf(req.file.path)) {
      fs.unlinkSync(req.file.path);
      res.status(400).json({ error: "El archivo no es un PDF válido" });
      return;
    }
    if (fs.existsSync(r.archivo_path as string)) {
      fs.unlinkSync(r.archivo_path as string);
    }
    archivo_nombre = req.file.filename;
    archivo_path = req.file.path;
  }

  if (role === "bioanalista") {
    await db.run("UPDATE resultados SET archivo_nombre = ?, archivo_path = ? WHERE id = ?",
      [archivo_nombre, archivo_path, req.params!.id]);
    res.json({ mensaje: "Archivo actualizado exitosamente" });
  } else {
    const { titulo, tipo } = req.body;
    await db.run(
      "UPDATE resultados SET titulo = ?, tipo = ?, archivo_nombre = ?, archivo_path = ? WHERE id = ?",
      [titulo || r.titulo, tipo || r.tipo, archivo_nombre, archivo_path, req.params!.id]
    );
    res.json({ mensaje: "Resultado actualizado exitosamente" });
  }
});

router.delete("/:id", validateId(), async (req, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Solo el administrador puede eliminar resultados" }); return;
  }

  const db = getDatabase();
  const result = await db.exec("SELECT * FROM resultados WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado" }); return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const r: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { r[col] = row[i]; });

  if (fs.existsSync(r.archivo_path as string)) {
    fs.unlinkSync(r.archivo_path as string);
  }
  await db.run("DELETE FROM resultados WHERE id = ?", [req.params!.id]);
  res.json({ mensaje: "Resultado eliminado exitosamente" });
});

router.put("/:id/aprobar", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin" && req.user!.role !== "recepcionista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  const result = await db.exec("SELECT id, cita_id, estado FROM resultados WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado" }); return;
  }
  const row = result[0].values[0];
  if (row[2] !== "pendiente") {
    res.status(409).json({ error: "El resultado ya fue procesado" }); return;
  }
  await db.run("UPDATE resultados SET estado = 'aprobado' WHERE id = ?", [req.params!.id]);
  const citaId = row[1];
  if (citaId) {
    await db.run("UPDATE citas SET estado = 'completada' WHERE id = ?", [citaId]);
  }
  res.json({ mensaje: "Resultado aprobado exitosamente" });
});

router.put("/:id/rechazar", validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin" && req.user!.role !== "recepcionista") {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  const result = await db.exec("SELECT id, cita_id, estado FROM resultados WHERE id = ?", [req.params!.id]);
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado" }); return;
  }
  const row = result[0].values[0];
  if (row[2] !== "pendiente") {
    res.status(409).json({ error: "El resultado ya fue procesado" }); return;
  }
  await db.run("UPDATE resultados SET estado = 'rechazado' WHERE id = ?", [req.params!.id]);
  // Resetear análisis y cita a pendiente para que se puedan rehacer
  const citaId = row[1];
  if (citaId) {
    await db.run("UPDATE analisis SET estado = 'pendiente' WHERE cita_id = ?", [citaId]);
    await db.run("UPDATE citas SET estado = 'pendiente' WHERE id = ?", [citaId]);
  }
  res.json({ mensaje: "Resultado rechazado. Los análisis y la cita se han restablecido a pendiente." });
});

export default router;
