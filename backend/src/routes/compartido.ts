import { Router } from "express";
import fs from "fs";
import rateLimit from "express-rate-limit";
import { getDatabase } from "../config/database";

const router = Router();

const compartidoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Demasiadas solicitudes, intente más tarde" },
});

async function expireToken(token: string) {
  const db = getDatabase();
  await db.run("UPDATE resultados SET compartido_expira = NOW() WHERE compartido_token = ?", [token]);
}

router.get("/:token", compartidoLimiter, async (req, res) => {
  const db = getDatabase();
  const result = await db.exec(
    `SELECT r.id, r.titulo, r.tipo, r.archivo_nombre, r.created_at,
            u.nombre as paciente_nombre, u.apellido as paciente_apellido,
            c.fecha as cita_fecha, c.hora_inicio, c.hora_fin, c.medico
     FROM resultados r
     JOIN pacientes p ON p.id = r.paciente_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN citas c ON c.id = r.cita_id
      WHERE r.compartido_token = ? AND (r.compartido_expira IS NULL OR r.compartido_expira > NOW())`,
    [req.params.token as string]
  );
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
    return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const info: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { info[col] = row[i]; });

  res.json(info);
});

router.get("/:token/download", compartidoLimiter, async (req, res) => {
  const db = getDatabase();
  const result = await db.exec(
    "SELECT archivo_path, archivo_nombre, archivo_data FROM resultados WHERE compartido_token = ? AND (compartido_expira IS NULL OR compartido_expira > NOW())",
    [req.params.token as string]
  );
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
    return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const r: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { r[col] = row[i]; });

  const fileName = r.archivo_nombre as string;

  if (r.archivo_data) {
    const buf = r.archivo_data instanceof Buffer ? r.archivo_data : Buffer.from(r.archivo_data as Uint8Array);
    await expireToken(req.params.token as string);
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buf);
    return;
  }

  const filePath = r.archivo_path as string;
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  await expireToken(req.params.token as string);
  res.download(filePath, fileName);
});

export default router;
