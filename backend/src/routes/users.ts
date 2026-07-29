import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

function validateId(field = "id") {
  return param(field).isInt({ min: 1 }).withMessage(`${field} inválido`);
}

const VALID_ROLES = ["admin", "recepcionista", "bioanalista", "paciente"];

const router = Router();
router.use(authMiddleware);

function isAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Solo administradores pueden realizar esta acción" });
    return;
  }
  next();
}

router.get("/", isAdmin, async (req, res) => {
  const db = getDatabase();
  const result = await db.exec(`
    SELECT u.id, u.nombre, u.apellido, u.email, u.role, u.created_at,
           p.telefono, p.direccion, p.fecha_nacimiento, p.dni
    FROM users u
    LEFT JOIN pacientes p ON p.user_id = u.id
    ORDER BY u.role, u.apellido ASC
  `);
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(rows);
});

router.get("/bioanalistas", async (req, res) => {
  if (!req.user || !["admin", "recepcionista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  const result = await db.exec(
    "SELECT id, nombre, apellido, email FROM users WHERE role = 'bioanalista' ORDER BY apellido ASC"
  );
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(rows);
});

router.get("/:id", isAdmin, validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const db = getDatabase();
  const userId = req.params.id as string;
  const result = await db.exec(
    `SELECT u.id, u.nombre, u.apellido, u.email, u.role, u.created_at,
           p.telefono, p.direccion, p.fecha_nacimiento, p.dni
    FROM users u
    LEFT JOIN pacientes p ON p.user_id = u.id
    WHERE u.id = ?`,
    [userId]
  );
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const obj: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
  res.json(obj);
});

router.post("/",
  isAdmin,
  body("nombre").trim().isLength({ min: 1, max: 100 }).withMessage("Nombre requerido (máx 100)"),
  body("apellido").trim().isLength({ min: 1, max: 100 }).withMessage("Apellido requerido (máx 100)"),
  body("email").isEmail().withMessage("Email inválido"),
  body("password").isLength({ min: 8, max: 25 }).withMessage("Mínimo 8 caracteres (máx 25)"),
  body("role").isIn(VALID_ROLES).withMessage("Rol inválido"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  body("fecha_nacimiento").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Fecha inválida"),
  body("dni").optional({ values: "falsy" }).matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const { nombre, apellido, email, password, role, telefono, direccion, fecha_nacimiento, dni } = req.body;
  if (!nombre || !apellido || !email || !password || !role) {
    res.status(400).json({ error: "nombre, apellido, email, password y role son requeridos" });
    return;
  }

  const db = getDatabase();

  if (dni && role === "paciente") {
    const dniExists = await db.exec("SELECT id FROM pacientes WHERE dni = ?", [dni]);
    if (dniExists.length && dniExists[0].values.length) {
      res.status(409).json({ error: "El DNI ya está registrado" });
      return;
    }
  }

  const existing = await db.exec("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length && existing[0].values.length) {
    res.status(409).json({ error: "El email ya está registrado" });
    return;
  }

  const validRoles = ["admin", "recepcionista", "bioanalista", "paciente"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Rol inválido" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const insertResult = await db.exec(
    "INSERT INTO users (nombre, apellido, email, password, role) VALUES (?, ?, ?, ?, ?) RETURNING id",
    [nombre, apellido, email, hashedPassword, role]
  );
  const userId = insertResult[0].values[0][0];

  if (role === "paciente") {
    await db.run(
      "INSERT INTO pacientes (user_id, telefono, direccion, fecha_nacimiento, dni) VALUES (?, ?, ?, ?, ?)",
      [userId, (telefono || ""), (direccion || ""), (fecha_nacimiento || ""), (dni || "")]
    );
  }

  res.status(201).json({ mensaje: "Usuario creado exitosamente", id: userId });
});

router.put("/:id",
  isAdmin,
  validateId(),
  body("nombre").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 100 }).withMessage("Nombre inválido (máx 100)"),
  body("apellido").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 100 }).withMessage("Apellido inválido (máx 100)"),
  body("email").optional({ values: "falsy" }).isEmail().withMessage("Email inválido"),
  body("password").optional({ values: "falsy" }).isLength({ min: 8, max: 25 }).withMessage("Mínimo 8 caracteres (máx 25)"),
  body("role").optional({ values: "falsy" }).isIn(VALID_ROLES).withMessage("Rol inválido"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  body("fecha_nacimiento").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Fecha inválida"),
  body("dni").optional({ values: "falsy" }).matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const { nombre, apellido, email, password, role, telefono, direccion, fecha_nacimiento, dni } = req.body;
  const db = getDatabase();
  const userId = parseInt(req.params.id as string);

  if (email) {
    const existing = await db.exec("SELECT id FROM users WHERE email = ? AND id != ?", [email, userId]);
    if (existing.length && existing[0].values.length) {
      res.status(409).json({ error: "El email ya está en uso" });
      return;
    }
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  if (nombre) { updates.push("nombre = ?"); params.push(nombre); }
  if (apellido) { updates.push("apellido = ?"); params.push(apellido); }
  if (email) { updates.push("email = ?"); params.push(email); }
  if (role) { updates.push("role = ?"); params.push(role); }
  if (password) { updates.push("password = ?"); params.push(await bcrypt.hash(password, 10)); }

  if (updates.length) {
    params.push(userId);
    await db.run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
  }

  if (password) {
    await db.run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [userId]);
  }

  const existingPaciente = await db.exec("SELECT id FROM pacientes WHERE user_id = ?", [userId]);
  if (existingPaciente.length && existingPaciente[0].values.length) {
    const pUpdates: string[] = [];
    const pParams: unknown[] = [];
    if (telefono !== undefined) { pUpdates.push("telefono = ?"); pParams.push(telefono); }
    if (direccion !== undefined) { pUpdates.push("direccion = ?"); pParams.push(direccion); }
    if (fecha_nacimiento !== undefined) { pUpdates.push("fecha_nacimiento = ?"); pParams.push(fecha_nacimiento); }
    if (dni !== undefined) { pUpdates.push("dni = ?"); pParams.push(dni); }
    if (pUpdates.length) {
      pParams.push(userId);
      await db.run(`UPDATE pacientes SET ${pUpdates.join(", ")} WHERE user_id = ?`, pParams);
    }
  }

  res.json({ mensaje: "Usuario actualizado exitosamente" });
});

router.delete("/:id", isAdmin, validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  const userId = parseInt(req.params.id as string);
  if (userId === req.user!.userId) {
    res.status(400).json({ error: "No puedes eliminarte a ti mismo" });
    return;
  }
  const db = getDatabase();

  // Clean up related records
  const pacResult = await db.exec("SELECT id FROM pacientes WHERE user_id = ?", [userId]);
  if (pacResult.length && pacResult[0].values.length) {
    const pacienteId = pacResult[0].values[0][0] as number;
    const citaResult = await db.exec("SELECT id FROM citas WHERE paciente_id = ?", [pacienteId]);
    if (citaResult.length && citaResult[0].values.length) {
      const citaIds = citaResult[0].values.map((r) => r[0]);
      const ph = citaIds.map(() => "?").join(",");
      await db.run(`DELETE FROM analisis WHERE cita_id IN (${ph})`, citaIds as unknown[]);
      await db.run(`DELETE FROM resultados WHERE paciente_id = ?`, [pacienteId]);
      await db.run(`DELETE FROM citas WHERE paciente_id = ?`, [pacienteId]);
    }
    await db.run("DELETE FROM pacientes WHERE user_id = ?", [userId]);
  }

  await db.run("DELETE FROM resenas WHERE user_id = ?", [userId]);
  await db.run("DELETE FROM users WHERE id = ?", [userId]);
  res.json({ mensaje: "Usuario eliminado exitosamente" });
});

export default router;
