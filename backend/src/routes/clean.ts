import { Router } from "express";
import { getDatabase } from "../config/database";

const router = Router();

router.get("/users", async (_req, res) => {
  const db = getDatabase();
  const result = await db.exec("SELECT id, nombre, apellido, email, role FROM users ORDER BY id");
  res.json({ usuarios: result?.[0]?.values.map((r, i) => ({
    id: r[0], nombre: r[1], apellido: r[2], email: r[3], role: r[4],
  })) ?? [] });
});

router.post("/clean-database", async (_req, res) => {
  const db = getDatabase();
  const key = _req.headers["x-clean-key"];
  if (key !== "limpiar-123") {
    res.status(401).json({ error: "No autorizado" });
    return;
  }
  const emailsToKeep = (_req.body?.emailsToKeep as string[]) ?? [];
  if (!emailsToKeep.length) {
    res.status(400).json({ error: "Enviar emailsToKeep en el body" });
    return;
  }
  try {
    await db.run("DELETE FROM analisis");
    await db.run("DELETE FROM resultados");
    await db.run("DELETE FROM citas");
    await db.run("DELETE FROM resenas");
    await db.run("DELETE FROM password_reset_tokens");
    await db.run("DELETE FROM doctores");
    await db.run("DELETE FROM pacientes");
    const placeholders = emailsToKeep.map((e) => `'${e.replace(/'/g, "''")}'`).join(",");
    await db.run(`DELETE FROM users WHERE email NOT IN (${placeholders})`);
    for (const email of emailsToKeep) {
      await db.run(
        "INSERT INTO pacientes (user_id) SELECT id FROM users WHERE email = ? AND (SELECT role FROM users WHERE email = ?) = 'paciente' ON CONFLICT DO NOTHING",
        [email, email]
      );
    }
    const result = await db.exec("SELECT id, nombre, apellido, email, role FROM users ORDER BY id");
    res.json({
      mensaje: "BD limpiada exitosamente",
      usuarios: result?.[0]?.values.map((r) => ({
        id: r[0], nombre: r[1], apellido: r[2], email: r[3], role: r[4],
      })) ?? [],
    });
  } catch (err) {
    console.error("Error limpiando BD:", err);
    res.status(500).json({ error: "Error limpiando BD: " + (err as Error).message });
  }
});

export default router;
