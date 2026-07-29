import { Router } from "express";
import { body, param, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

function validateId(field = "id") {
  return param(field).isInt({ min: 1 }).withMessage(`${field} inválido`);
}

const router = Router();

router.get("/aprobadas", async (_req, res) => {
  const db = getDatabase();
  const result = await db.exec(
    "SELECT id, user_id, nombre, texto, estrellas, aprobado, created_at FROM resenas WHERE aprobado = 1 ORDER BY created_at DESC"
  );
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(rows);
});

router.post("/", authMiddleware,
  body("texto").trim().notEmpty().withMessage("Texto requerido"),
  body("estrellas").optional().isInt({ min: 1, max: 5 }).withMessage("Estrellas debe ser 1-5"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  if (req.user!.role !== "paciente") {
    res.status(403).json({ error: "Solo pacientes pueden crear reseñas" });
    return;
  }
  const { texto, estrellas } = req.body;
  if (!texto || !texto.trim()) {
    res.status(400).json({ error: "El texto de la reseña es obligatorio" });
    return;
  }
  const db = getDatabase();
  const userResult = await db.exec("SELECT nombre, apellido FROM users WHERE id = ?", [req.user!.userId]);
  if (!userResult.length || !userResult[0].values.length) {
    res.status(404).json({ error: "Usuario no encontrado" });
    return;
  }
  const nombre = `${userResult[0].values[0][0]} ${userResult[0].values[0][1]}`;
  const rating = estrellas && Number(estrellas) >= 1 && Number(estrellas) <= 5 ? Number(estrellas) : 5;
  await db.run(
    "INSERT INTO resenas (user_id, nombre, texto, estrellas) VALUES (?, ?, ?, ?)",
    [req.user!.userId, nombre, texto, rating]
  );
  res.status(201).json({ mensaje: "Reseña creada exitosamente. Será publicada tras revisión." });
});

router.get("/", authMiddleware, async (req, res) => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  const db = getDatabase();
  const result = await db.exec(
    "SELECT r.*, u.email FROM resenas r JOIN users u ON u.id = r.user_id ORDER BY r.aprobado ASC, r.created_at DESC"
  );
  if (!result.length) { res.json([]); return; }
  const cols = result[0].columns;
  const rows = result[0].values.map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((col: string, i: number) => { obj[col] = row[i]; });
    return obj;
  });
  res.json(rows);
});

router.put("/:id/aprobar", authMiddleware, validateId(),
  body("aprobado").isBoolean().withMessage("aprobado debe ser booleano"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  const { aprobado } = req.body;
  const db = getDatabase();
  await db.run("UPDATE resenas SET aprobado = ? WHERE id = ?", [aprobado ? 1 : 0, req.params!.id]);
  res.json({ mensaje: aprobado ? "Reseña aprobada" : "Reseña rechazada" });
});

router.put("/:id", authMiddleware, validateId(),
  body("texto").trim().notEmpty().withMessage("Texto requerido"),
  body("estrellas").optional().isInt({ min: 1, max: 5 }).withMessage("Estrellas debe ser 1-5"),
  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }

  if (req.user!.role !== "paciente") {
    res.status(403).json({ error: "Solo pacientes pueden editar reseñas" });
    return;
  }
  const db = getDatabase();
  const existing = await db.exec("SELECT user_id FROM resenas WHERE id = ?", [req.params!.id]);
  if (!existing.length || !existing[0].values.length) {
    res.status(404).json({ error: "Reseña no encontrada" });
    return;
  }
  if (existing[0].values[0][0] !== req.user!.userId) {
    res.status(403).json({ error: "No puedes editar una reseña que no te pertenece" });
    return;
  }
  const { texto, estrellas } = req.body;
  const rating = estrellas && Number(estrellas) >= 1 && Number(estrellas) <= 5 ? Number(estrellas) : 5;
  await db.run("UPDATE resenas SET texto = ?, estrellas = ?, aprobado = 0 WHERE id = ?", [texto, rating, req.params!.id]);
  res.json({ mensaje: "Reseña actualizada. Será revisada nuevamente." });
});

router.delete("/:id", authMiddleware, validateId(), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) { res.status(400).json({ error: errors.array()[0].msg }); return; }
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  const db = getDatabase();
  await db.run("DELETE FROM resenas WHERE id = ?", [req.params!.id]);
  res.json({ mensaje: "Reseña eliminada" });
});

export default router;
