import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { body, validationResult } from "express-validator";
import rateLimit from "express-rate-limit";
import { findUserByEmail, createUser, findUserById } from "../models/user";
import { generateToken, authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";
import type { LoginBody } from "../types";
import type { Response } from "express";
import { sendPasswordResetEmail, sendVerificationEmail } from "../utils/email";

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Demasiados intentos. Intenta de nuevo en 15 minutos." },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Demasiados intentos. Intenta de nuevo en 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 2 * 60 * 60 * 1000,
  path: "/",
};

function setTokenCookie(res: Response, token: string) {
  res.cookie("token", token, COOKIE_OPTIONS);
}

const PASSWORD_RULES = "Mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 dígito y 1 carácter especial";

router.post("/login", loginLimiter,
  body("email").isEmail().withMessage("Email inválido"),
  body("password").notEmpty().withMessage("Contraseña requerida"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const { email, password } = req.body as LoginBody;

  const user = await findUserByEmail(email);

  if (!user) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  // Block unverified users
  if (!user.email_verified) {
    res.status(403).json({ error: "Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada." });
    return;
  }

  let valid = false;
  try { valid = await bcrypt.compare(password, user.password!); } catch {
    res.status(500).json({ error: "Error interno" }); return;
  }

  if (!valid) {
    res.status(401).json({ error: "Credenciales inválidas" });
    return;
  }

  const token = generateToken({ userId: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, role: user.role, tokenVersion: user.token_version ?? 0 });

  setTokenCookie(res, token);

  res.json({
    user: {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      role: user.role,
    },
  });
});

router.post("/forgot-password", resetLimiter,
  body("email").isEmail().withMessage("Email inválido"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { email } = req.body;
    const db = getDatabase();

    const user = await findUserByEmail(email);
    if (!user) {
      res.json({ mensaje: "Si el email existe, recibirás instrucciones para restablecer tu contraseña" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.run(
      "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
      [user.id, token, expiresAt.toISOString()]
    );

    const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/reset-password?token=${token}`;
    await sendPasswordResetEmail(email, resetUrl, user.nombre);

    res.json({ mensaje: "Revisa tu correo para restablecer tu contraseña" });
  }
);

router.post("/register", loginLimiter,
  body("nombre").trim().isLength({ min: 1, max: 100 }).withMessage("Nombre requerido (máx 100 caracteres)"),
  body("apellido").trim().isLength({ min: 1, max: 100 }).withMessage("Apellido requerido (máx 100 caracteres)"),
  body("email").isEmail().isLength({ max: 255 }).withMessage("Email inválido (máx 255 caracteres)"),
  body("password")
    .isLength({ min: 8, max: 25 }).withMessage(PASSWORD_RULES)
    .matches(/[A-Z]/).withMessage(PASSWORD_RULES)
    .matches(/[a-z]/).withMessage(PASSWORD_RULES)
    .matches(/[0-9]/).withMessage(PASSWORD_RULES)
    .matches(/[^A-Za-z0-9]/).withMessage(PASSWORD_RULES),
  body("dni").matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  body("fecha_nacimiento").optional({ values: "falsy" }).matches(/^\d{4}-\d{2}-\d{2}$/).withMessage("Formato fecha debe ser YYYY-MM-DD"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const { nombre, apellido, email, password, fecha_nacimiento, telefono, direccion, dni } = req.body;

  if (!nombre || !apellido || !email || !password) {
    res.status(400).json({ error: "Todos los campos son requeridos" });
    return;
  }

  if (!dni || !dni.trim()) {
    res.status(400).json({ error: "El DNI es obligatorio" });
    return;
  }

  if (!/^\d{8}$/.test(dni)) {
    res.status(400).json({ error: "El DNI debe tener 8 dígitos" });
    return;
  }

  const dbCheck = getDatabase();
  const dniExists = await dbCheck.exec("SELECT p.id FROM pacientes p WHERE p.dni = ?", [dni]);
  if (dniExists.length && dniExists[0].values.length) {
    res.status(409).json({ error: "El DNI ya está registrado" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: PASSWORD_RULES });
    return;
  }

  const existing = await findUserByEmail(email);

  if (existing) {
    res.status(409).json({ error: "El email ya está registrado" });
    return;
  }

  let hashedPassword = "";
  try { hashedPassword = await bcrypt.hash(password, 10); } catch {
    res.status(500).json({ error: "Error interno" }); return;
  }

  const user = await createUser(nombre, apellido, email, hashedPassword);

  if (fecha_nacimiento || telefono || direccion || dni) {
    const db = getDatabase();
    const pUpdates: string[] = [];
    const pParams: unknown[] = [];
    if (fecha_nacimiento) { pUpdates.push("fecha_nacimiento = ?"); pParams.push(fecha_nacimiento); }
    if (telefono) { pUpdates.push("telefono = ?"); pParams.push(telefono); }
    if (direccion) { pUpdates.push("direccion = ?"); pParams.push(direccion); }
    if (dni) { pUpdates.push("dni = ?"); pParams.push(dni); }
    if (pUpdates.length) {
      pParams.push(user.id);
      await db.run(`UPDATE pacientes SET ${pUpdates.join(", ")} WHERE user_id = ?`, pParams);
    }
  }

  // Send verification email
  const dbVerify = getDatabase();
  const tokenResult = await dbVerify.exec("SELECT email_verification_token FROM users WHERE id = ?", [user.id]);
  const verifyToken = tokenResult[0].values[0][0] as string;
  const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${verifyToken}`;
  try {
    await sendVerificationEmail(email, verifyUrl, nombre);
  } catch (err) {
    console.error("Error enviando email de verificación:", err);
  }

  res.status(201).json({
    mensaje: "Cuenta creada. Revisa tu correo para verificar tu cuenta.",
    verifyUrl,
  });
});

router.post("/resend-verification",
  body("email").isEmail().withMessage("Email inválido"),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { email } = req.body;
    const db = getDatabase();
    const user = await findUserByEmail(email);

    if (!user) {
      res.status(404).json({ error: "Usuario no encontrado" });
      return;
    }

    if (user.email_verified) {
      res.status(400).json({ error: "El correo ya fue verificado" });
      return;
    }

    const token = crypto.randomBytes(32).toString("hex");
    await db.run("UPDATE users SET email_verification_token = ? WHERE id = ?", [token, user.id]);

    const verifyUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/verify-email?token=${token}`;
    try {
      await sendVerificationEmail(email, verifyUrl, user.nombre);
    } catch (err) {
      console.error("Error reenviando email de verificación:", err);
      res.status(500).json({ error: "Error al enviar el correo. Intenta de nuevo." });
      return;
    }

    res.json({ mensaje: "Correo reenviado. Revisa tu bandeja de entrada." });
  }
);

router.get("/verify-email/:token", async (req, res) => {
  const { token } = req.params;
  if (!token || typeof token !== "string" || token.length < 10) {
    res.status(400).json({ error: "Token inválido" }); return;
  }

  const db = getDatabase();
  const result = await db.exec(
    "SELECT id, email_verified FROM users WHERE email_verification_token = ? AND email_verified = FALSE",
    [token]
  );

  if (!result.length || !result[0].values.length) {
    res.status(400).json({ error: "Token inválido o el correo ya fue verificado" });
    return;
  }

  const userId = result[0].values[0][0] as number;
  await db.run(
    "UPDATE users SET email_verified = TRUE, email_verification_token = NULL WHERE id = ?",
    [userId]
  );

  res.json({ mensaje: "Correo verificado exitosamente. Ahora puedes iniciar sesión." });
});

router.post("/reset-password", resetLimiter,
  body("token").notEmpty().withMessage("Token requerido"),
  body("password")
    .isLength({ min: 8, max: 25 }).withMessage(PASSWORD_RULES)
    .matches(/[A-Z]/).withMessage(PASSWORD_RULES)
    .matches(/[a-z]/).withMessage(PASSWORD_RULES)
    .matches(/[0-9]/).withMessage(PASSWORD_RULES)
    .matches(/[^A-Za-z0-9]/).withMessage(PASSWORD_RULES),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

    const { token, password } = req.body;
    const db = getDatabase();

    const result = await db.exec(
      `SELECT prt.*, u.email, u.nombre FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = ? AND prt.expires_at > NOW() AND prt.used = FALSE`,
      [token]
    );

    if (!result.length || !result[0].values.length) {
      res.status(400).json({ error: "Token inválido o expirado" });
      return;
    }

    const cols = result[0].columns;
    const row = result[0].values[0];
    const tokenData: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { tokenData[col] = row[i]; });

    const userId = tokenData.user_id as number;
    const email = tokenData.email as string;

    let hashedPassword = "";
    try { hashedPassword = await bcrypt.hash(password, 10); } catch {
      res.status(500).json({ error: "Error interno" }); return;
    }

    await db.run("UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?", [hashedPassword, userId]);
    await db.run("UPDATE password_reset_tokens SET used = TRUE WHERE id = ?", [tokenData.id]);

    res.json({ mensaje: "Contraseña actualizada exitosamente" });
  }
);

router.put("/perfil", authMiddleware,
  body("nombre").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 100 }).withMessage("Nombre inválido (máx 100)"),
  body("apellido").optional({ values: "falsy" }).trim().isLength({ min: 1, max: 100 }).withMessage("Apellido inválido (máx 100)"),
  body("email").optional({ values: "falsy" }).isEmail().withMessage("Email inválido"),
  body("password").optional({ values: "falsy" })
    .isLength({ min: 8, max: 25 }).withMessage(PASSWORD_RULES)
    .matches(/[A-Z]/).withMessage(PASSWORD_RULES)
    .matches(/[a-z]/).withMessage(PASSWORD_RULES)
    .matches(/[0-9]/).withMessage(PASSWORD_RULES)
    .matches(/[^A-Za-z0-9]/).withMessage(PASSWORD_RULES),
  body("dni").optional({ values: "falsy" }).matches(/^\d{8}$/).withMessage("DNI debe tener 8 dígitos"),
  body("telefono").optional({ values: "falsy" }).isLength({ max: 20 }).withMessage("Teléfono muy largo"),
  body("direccion").optional({ values: "falsy" }).isLength({ max: 500 }).withMessage("Dirección muy larga"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  const { nombre, apellido, email, password, telefono, direccion, fecha_nacimiento, dni } = req.body;
  const db = getDatabase();
  const userId = req.user!.userId;

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
  if (password) {
    let hashedPw = "";
    try { hashedPw = await bcrypt.hash(password, 10); } catch {
      res.status(500).json({ error: "Error interno" }); return;
    }
    updates.push("password = ?"); params.push(hashedPw);
  }

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

  const user = await findUserById(userId);
  let dniResp = "", telefonoResp = "", direccionResp = "";
  const pUpd = await db.exec("SELECT dni, telefono, direccion FROM pacientes WHERE user_id = ?", [userId]);
  if (pUpd.length && pUpd[0].values.length) {
    const pc = pUpd[0].columns, pr = pUpd[0].values[0];
    const pd: Record<string, unknown> = {};
    pc.forEach((c: string, i: number) => { pd[c] = pr[i]; });
    dniResp = (pd.dni as string) || "";
    telefonoResp = (pd.telefono as string) || "";
    direccionResp = (pd.direccion as string) || "";
  }
  res.json({ mensaje: "Perfil actualizado exitosamente", user: user ? { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, role: user.role, dni: dniResp, telefono: telefonoResp, direccion: direccionResp } : null });
});

router.post("/logout", authMiddleware, async (req, res) => {
  const db = getDatabase();
  await db.run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [req.user!.userId]);
  res.clearCookie("token", { path: "/" });
  res.json({ mensaje: "Sesión cerrada" });
});

router.get("/me", authMiddleware, async (req, res) => {
  const user = await findUserById(req.user!.userId);
  if (!user) { res.status(404).json({ error: "Usuario no encontrado" }); return; }
  const db = getDatabase();
  const pResult = await db.exec("SELECT dni, telefono, direccion FROM pacientes WHERE user_id = ?", [req.user!.userId]);
  let dni = "", telefono = "", direccion = "";
  if (pResult.length && pResult[0].values.length) {
    const pCols = pResult[0].columns;
    const pRow = pResult[0].values[0];
    const pData: Record<string, unknown> = {};
    pCols.forEach((col: string, i: number) => { pData[col] = pRow[i]; });
    dni = (pData.dni as string) || "";
    telefono = (pData.telefono as string) || "";
    direccion = (pData.direccion as string) || "";
  }
  res.json({
    user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, role: user.role, dni, telefono, direccion },
  });
});

router.post("/refresh", authMiddleware, async (req, res) => {
  const db = getDatabase();
  await db.run("UPDATE users SET token_version = token_version + 1 WHERE id = ?", [req.user!.userId]);
  const userResult = await db.exec("SELECT token_version FROM users WHERE id = ?", [req.user!.userId]);
  const newVersion = (userResult[0]?.values[0]?.[0] as number) ?? 0;
  const token = generateToken({ userId: req.user!.userId, nombre: req.user!.nombre, apellido: req.user!.apellido, email: req.user!.email, role: req.user!.role, tokenVersion: newVersion });
  setTokenCookie(res, token);
  res.json({ mensaje: "Token renovado" });
});

export default router;