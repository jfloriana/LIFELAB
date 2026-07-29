import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { body, param, query, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

const router = Router();

router.use(authMiddleware);

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Demasiadas búsquedas. Intenta de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/crear",
  body("nombre").trim().isLength({ min: 1, max: 100 }).withMessage("Nombre requerido (máx 100)"),
  body("apellido").trim().isLength({ min: 1, max: 100 }).withMessage("Apellido requerido (máx 100)"),
  body("email").isEmail().withMessage("Email inválido"),
  body("password").isLength({ min: 8, max: 25 }).withMessage("Mínimo 8 caracteres (máx 25)"),
  body("dni").optional({ values: "falsy" }).matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  let { nombre, apellido, email, password, telefono, direccion, fecha_nacimiento, dni } = req.body;

  const db = getDatabase();

  if (dni) {
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

  let hashedPassword = "";
  try { hashedPassword = await bcrypt.hash(password, 10); } catch {
    res.status(500).json({ error: "Error interno" }); return;
  }

  const result = await db.exec(
    "INSERT INTO users (nombre, apellido, email, password, role) VALUES (?, ?, ?, ?, 'paciente') RETURNING id",
    [nombre, apellido, email, hashedPassword]
  );
  const userId = result[0].values[0][0] as number;

  await db.run("INSERT INTO pacientes (user_id, telefono, direccion, fecha_nacimiento, dni) VALUES (?, ?, ?, ?, ?)",
    [userId, telefono || "", direccion || "", fecha_nacimiento || "", dni || ""]);

  const newUser = await db.exec(
    `SELECT p.id as paciente_id, u.id as user_id, u.nombre, u.apellido, u.email, p.telefono, p.fecha_nacimiento, p.direccion, p.dni
     FROM users u JOIN pacientes p ON p.user_id = u.id WHERE u.id = ?`,
    [userId]
  );
  const cols = newUser[0].columns;
  const row = newUser[0].values[0];
  const obj: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { obj[col] = row[i]; });

  res.status(201).json({ mensaje: "Paciente creado exitosamente", paciente: obj });
});

router.get("/todos", async (req, res) => {
  if (!req.user || !["admin", "recepcionista", "bioanalista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const db = getDatabase();
  const result = await db.exec(
    `SELECT p.id as id, u.id as user_id, u.nombre, u.apellido, u.email, p.telefono, p.fecha_nacimiento, p.dni, p.direccion
     FROM users u
     JOIN pacientes p ON p.user_id = u.id
     WHERE u.role = 'paciente'
     ORDER BY u.apellido ASC`
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

router.get("/buscar", searchLimiter, query("q").trim().isLength({ min: 1, max: 100 }), async (req, res) => {
  if (!req.user || !["admin", "recepcionista", "bioanalista"].includes(req.user.role)) {
    res.status(403).json({ error: "No autorizado" }); return;
  }
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ error: "Parámetro de búsqueda inválido", details: errors.array() }); return;
  }
  const { q } = req.query;
  const db = getDatabase();
  const result = await db.exec(
    `SELECT p.id as id, u.id as user_id, u.nombre, u.apellido, u.email, p.telefono, p.fecha_nacimiento, p.direccion, p.dni
     FROM users u
     JOIN pacientes p ON p.user_id = u.id
     WHERE u.role = 'paciente' AND (u.nombre ILIKE ? OR u.apellido ILIKE ? OR u.email ILIKE ? OR p.dni ILIKE ?)
     LIMIT 20`,
    [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
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

router.get("/perfil", async (req, res) => {
  const db = getDatabase();

  const result = await db.exec(
    `SELECT p.*, u.nombre, u.apellido, u.email
     FROM pacientes p
     JOIN users u ON u.id = p.user_id
     WHERE p.user_id = ?`,
    [req.user!.userId]
  );

  if (!result.length || !result[0].values.length) {
    res.json({ perfil: null });
    return;
  }

  const row = result[0].values[0];
  const cols = result[0].columns;
  const perfil: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => {
    perfil[col] = row[i];
  });

  res.json({ perfil });
});

router.post("/perfil",
  body("dni").optional({ values: "falsy" }).matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  body("fecha_nacimiento").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Formato fecha debe ser YYYY-MM-DD"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const { telefono, direccion, fecha_nacimiento, dni } = req.body;
  const db = getDatabase();

  if (dni) {
    const dup = await db.exec(
      "SELECT id FROM pacientes WHERE dni = ? AND user_id != ?",
      [dni, req.user!.userId]
    );
    if (dup.length && dup[0].values.length) {
      res.status(409).json({ error: "El DNI ya está registrado por otro paciente" });
      return;
    }
  }

  await db.run(
    `INSERT INTO pacientes (user_id, telefono, direccion, fecha_nacimiento, dni)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       telefono = excluded.telefono,
       direccion = excluded.direccion,
       fecha_nacimiento = excluded.fecha_nacimiento,
       dni = excluded.dni`,
    [req.user!.userId, telefono || null, direccion || null, fecha_nacimiento || null, dni || null]
  );

  res.json({ mensaje: "Perfil guardado exitosamente" });
});

router.put("/:id",
  param("id").isInt({ min: 1 }).withMessage("ID inválido"),
  body("nombre").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Nombre inválido (máx 100)"),
  body("apellido").optional().trim().isLength({ min: 1, max: 100 }).withMessage("Apellido inválido (máx 100)"),
  body("email").optional().isEmail().withMessage("Email inválido"),
  body("dni").optional({ values: "falsy" }).matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  body("fecha_nacimiento").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Formato fecha debe ser YYYY-MM-DD"),
  body("password").optional({ values: "falsy" }).isLength({ min: 8, max: 25 }).withMessage("Contraseña debe tener entre 8 y 25 caracteres"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  async (req, res) => {
    if (!req.user || !["admin", "recepcionista"].includes(req.user.role)) {
      res.status(403).json({ error: "No autorizado" }); return;
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const id = parseInt(req.params!.id);
    const db = getDatabase();

    const existing = await db.exec(
      "SELECT u.id, u.email FROM users u JOIN pacientes p ON p.user_id = u.id WHERE p.id = ?",
      [id]
    );
    if (!existing.length || !existing[0].values.length) {
      res.status(404).json({ error: "Paciente no encontrado" }); return;
    }
    const userId = existing[0].values[0][0] as number;
    const currentEmail = existing[0].values[0][1] as string;

    const { nombre, apellido, email, telefono, direccion, fecha_nacimiento, dni, password } = req.body;

    if (email && email !== currentEmail) {
      const dup = await db.exec("SELECT id FROM users WHERE email = ? AND id != ?", [email, userId]);
      if (dup.length && dup[0].values.length) {
        res.status(409).json({ error: "El email ya está en uso" }); return;
      }
    }

    if (dni) {
      const dup = await db.exec(
        "SELECT id FROM pacientes WHERE dni = ? AND user_id != ?",
        [dni, userId]
      );
      if (dup.length && dup[0].values.length) {
        res.status(409).json({ error: "El DNI ya está registrado por otro paciente" }); return;
      }
    }

    const userUpdates: string[] = [];
    const userParams: unknown[] = [];
    if (nombre !== undefined) { userUpdates.push("nombre = ?"); userParams.push(nombre); }
    if (apellido !== undefined) { userUpdates.push("apellido = ?"); userParams.push(apellido); }
    if (email !== undefined) { userUpdates.push("email = ?"); userParams.push(email); }
    if (password && password.length >= 8) {
      const hashed = await bcrypt.hash(password, 10);
      userUpdates.push("password = ?");
      userParams.push(hashed);
    }
    if (userUpdates.length) {
      userParams.push(userId);
      await db.run(`UPDATE users SET ${userUpdates.join(", ")} WHERE id = ?`, userParams);
    }

    if (password && password.length >= 8) {
      await db.run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [userId]);
    }

    const pacUpdates: string[] = [];
    const pacParams: unknown[] = [];
    if (telefono !== undefined) { pacUpdates.push("telefono = ?"); pacParams.push(telefono); }
    if (direccion !== undefined) { pacUpdates.push("direccion = ?"); pacParams.push(direccion); }
    if (fecha_nacimiento !== undefined) { pacUpdates.push("fecha_nacimiento = ?"); pacParams.push(fecha_nacimiento); }
    if (dni !== undefined) { pacUpdates.push("dni = ?"); pacParams.push(dni); }
    if (pacUpdates.length) {
      pacParams.push(id);
      await db.run(`UPDATE pacientes SET ${pacUpdates.join(", ")} WHERE id = ?`, pacParams);
    }

    res.json({ mensaje: "Paciente actualizado exitosamente" });
  }
);

export default router;
