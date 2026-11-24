import { Router } from "express";
import fs from "fs";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { getDatabase } from "../config/database";
import { logAcceso } from "./resultados";

const router = Router();

const compartidoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Demasiadas solicitudes, intente más tarde" },
});

const PREVIEW_TTL_SECONDS = 600;
const TICKET_PATTERN = /^[A-Za-z0-9-]{8,100}$/;
const PREVIEW_CONSUMED_MESSAGE = "Ya previsualizaste este documento. Vuelve a escanear el código QR para verlo de nuevo.";

/** Keeps the header value free of quotes, control characters and path separators. */
function safeFileName(name: unknown): string {
  const cleaned = String(name ?? "resultado.pdf").replace(/[^\w.\- ]/g, "_").slice(0, 120);
  return cleaned || "resultado.pdf";
}

async function issuePreviewTicket(resultadoId: number, token: string): Promise<string | null> {
  try {
    const db = getDatabase();
    // Opportunistic cleanup of old tickets; failures are irrelevant to the caller.
    await db.run("DELETE FROM compartido_vistas WHERE created_at < NOW() - INTERVAL '1 day'").catch(() => {});
    const ticket = crypto.randomUUID();
    await db.run(
      "INSERT INTO compartido_vistas (ticket, resultado_id, token, expires_at) VALUES (?, ?, ?, NOW() + INTERVAL '10 minutes')",
      [ticket, resultadoId, token]
    );
    return ticket;
  } catch (err) {
    console.error("No se pudo emitir el ticket de previsualización:", (err as Error)?.message);
    return null;
  }
}

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

  // Each page load is one "scan": issue a single-use preview ticket. Best-effort,
  // so a failing ticket store never breaks the metadata response.
  const ticket = await issuePreviewTicket(Number(info.id), req.params.token as string);
  if (ticket) {
    info.ticket = ticket;
    info.preview_ttl_seconds = PREVIEW_TTL_SECONDS;
  }

  res.json(info);
});

router.post("/:token/previsualizar", compartidoLimiter, async (req, res) => {
  const ticket = (req.body as { ticket?: unknown } | undefined)?.ticket;
  if (typeof ticket !== "string" || !TICKET_PATTERN.test(ticket)) {
    res.status(400).json({ error: "Ticket inválido" });
    return;
  }

  const token = req.params.token as string;
  const db = getDatabase();
  const result = await db.exec(
    "SELECT id, archivo_path, archivo_nombre, archivo_data FROM resultados WHERE compartido_token = ? AND (compartido_expira IS NULL OR compartido_expira > NOW())",
    [token]
  );
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
    return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const r: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { r[col] = row[i]; });

  let pdf: Buffer | null = null;
  if (r.archivo_data) {
    pdf = r.archivo_data instanceof Buffer ? r.archivo_data : Buffer.from(r.archivo_data as Uint8Array);
  } else if (!r.archivo_path || !fs.existsSync(r.archivo_path as string)) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  // Atomic single-use consumption: one statement flips used_at only if the ticket is
  // still unused and unexpired, so concurrent requests cannot both succeed.
  const consumed = await db.exec(
    "UPDATE compartido_vistas SET used_at = NOW() WHERE ticket = ? AND token = ? AND used_at IS NULL AND expires_at > NOW() RETURNING resultado_id",
    [ticket, token]
  );
  if (!consumed.length || !consumed[0].values.length) {
    res.status(410).json({ error: PREVIEW_CONSUMED_MESSAGE, codigo: "PREVIEW_CONSUMED" });
    return;
  }

  if (!pdf) {
    try {
      pdf = await fs.promises.readFile(r.archivo_path as string);
    } catch {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }
  }

  logAcceso(req, Number(r.id), "previsualizacion_compartida");
  res.set("Content-Type", "application/pdf");
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
  res.set("Content-Disposition", `inline; filename="${safeFileName(r.archivo_nombre)}"`);
  res.send(pdf);
});

router.get("/:token/download", compartidoLimiter, async (req, res) => {
  const db = getDatabase();
  const result = await db.exec(
    "SELECT id, archivo_path, archivo_nombre, archivo_data FROM resultados WHERE compartido_token = ? AND (compartido_expira IS NULL OR compartido_expira > NOW())",
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
    logAcceso(req, Number(r.id), "descarga_compartida");
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

  logAcceso(req, Number(r.id), "descarga_compartida");
  await expireToken(req.params.token as string);
  res.download(filePath, fileName);
});

export default router;
