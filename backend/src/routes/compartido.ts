import { Router, type Response } from "express";
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
const TICKET_HEADER = "x-compartido-ticket";
const QR_USED_MESSAGE = "Este código ya fue usado. Pide uno nuevo.";
const PREVIEW_CONSUMED_MESSAGE = "Ya previsualizaste este documento. Vuelve a escanear el código QR para verlo de nuevo.";

/** Keeps the header value free of quotes, control characters and path separators. */
function safeFileName(name: unknown): string {
  const cleaned = String(name ?? "resultado.pdf").replace(/[^\w.\- ]/g, "_").slice(0, 120);
  return cleaned || "resultado.pdf";
}

/** Opens a scan session: one ticket worth one preview and one download. */
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
    console.error("No se pudo emitir el ticket de la sesión de escaneo:", (err as Error)?.message);
    return null;
  }
}

// Best-effort: any failure is logged and treated as "unknown" so callers fall back to a plain 404.
async function isKnownToken(token: string): Promise<boolean> {
  try {
    const known = await getDatabase().exec("SELECT id FROM resultados WHERE compartido_token = ? LIMIT 1", [token]);
    return known.length > 0 && known[0].values.length > 0;
  } catch (err) {
    console.error("No se pudo comprobar el estado del token:", (err as Error)?.message);
    return false;
  }
}

function setPrivateHeaders(res: Response) {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.set("Pragma", "no-cache");
}

/** Loads the stored file of a result; only called after a session slot was consumed atomically. */
async function loadFile(resultadoId: number): Promise<{ pdf?: Buffer; path?: string; name: string } | null> {
  const found = await getDatabase().exec(
    "SELECT id, archivo_path, archivo_nombre, archivo_data FROM resultados WHERE id = ?",
    [resultadoId]
  );
  if (!found.length || !found[0].values.length) return null;
  const r: Record<string, unknown> = {};
  found[0].columns.forEach((col: string, i: number) => { r[col] = found[0].values[0][i]; });
  const name = safeFileName(r.archivo_nombre);
  if (r.archivo_data) {
    return { pdf: r.archivo_data instanceof Buffer ? r.archivo_data : Buffer.from(r.archivo_data as Uint8Array), name };
  }
  if (r.archivo_path && fs.existsSync(r.archivo_path as string)) return { path: r.archivo_path as string, name };
  return null;
}

// The FIRST load of the share page is the one and only "scan": the token is flagged as scanned in
// a single atomic statement, so concurrent or later requests can never obtain a session.
router.get("/:token", compartidoLimiter, async (req, res) => {
  const db = getDatabase();
  const token = req.params.token as string;
  const scanned = await db.exec(
    `UPDATE resultados SET compartido_escaneado_at = NOW()
      WHERE compartido_token = ? AND (compartido_expira IS NULL OR compartido_expira > NOW())
        AND compartido_escaneado_at IS NULL
      RETURNING id`,
    [token]
  );
  if (!scanned.length || !scanned[0].values.length) {
    // A token that exists but was already scanned (or aged out) is "used"; tell it apart
    // from a token that never existed.
    if (await isKnownToken(token)) {
      res.status(410).json({ error: QR_USED_MESSAGE, codigo: "QR_USED" });
      return;
    }
    res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
    return;
  }

  const result = await db.exec(
    `SELECT r.id, r.titulo, r.tipo, r.archivo_nombre, r.created_at,
            u.nombre as paciente_nombre, u.apellido as paciente_apellido,
            c.fecha as cita_fecha, c.hora_inicio, c.hora_fin, c.medico
     FROM resultados r
     JOIN pacientes p ON p.id = r.paciente_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN citas c ON c.id = r.cita_id
      WHERE r.id = ?`,
    [Number(scanned[0].values[0][0])]
  );
  if (!result.length || !result[0].values.length) {
    res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
    return;
  }
  const cols = result[0].columns;
  const row = result[0].values[0];
  const info: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => { info[col] = row[i]; });

  // The scan opens a session (ticket) worth one preview and one download. Best-effort,
  // so a failing ticket store never breaks the metadata response.
  const ticket = await issuePreviewTicket(Number(info.id), token);
  if (ticket) {
    info.ticket = ticket;
    info.preview_ttl_seconds = PREVIEW_TTL_SECONDS;
  }

  setPrivateHeaders(res);
  res.json(info);
});

router.post("/:token/previsualizar", compartidoLimiter, async (req, res) => {
  const ticket = (req.body as { ticket?: unknown } | undefined)?.ticket;
  if (typeof ticket !== "string" || !TICKET_PATTERN.test(ticket)) {
    res.status(400).json({ error: "Ticket inválido" });
    return;
  }

  const token = req.params.token as string;
  // Atomic single-use consumption of the preview slot: one statement flips used_at only if the
  // session is unused and unexpired, so concurrent requests cannot both succeed. The share
  // token's own state is irrelevant here (the scan already consumed it).
  const consumed = await getDatabase().exec(
    "UPDATE compartido_vistas SET used_at = NOW() WHERE ticket = ? AND token = ? AND used_at IS NULL AND expires_at > NOW() RETURNING resultado_id",
    [ticket, token]
  );
  if (!consumed.length || !consumed[0].values.length) {
    if (await isKnownToken(token)) {
      res.status(410).json({ error: PREVIEW_CONSUMED_MESSAGE, codigo: "PREVIEW_CONSUMED" });
      return;
    }
    res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
    return;
  }

  const resultadoId = Number(consumed[0].values[0][0]);
  const file = await loadFile(resultadoId);
  if (!file) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }
  let pdf = file.pdf;
  if (!pdf) {
    try {
      pdf = await fs.promises.readFile(file.path as string);
    } catch {
      res.status(404).json({ error: "Archivo no encontrado" });
      return;
    }
  }

  logAcceso(req, resultadoId, "previsualizacion_compartida");
  res.set("Content-Type", "application/pdf");
  setPrivateHeaders(res);
  res.set("Content-Disposition", `inline; filename="${file.name}"`);
  res.send(pdf);
});

// The session ticket travels in a header (never in the URL) so it cannot end up in access logs.
router.get("/:token/download", compartidoLimiter, async (req, res) => {
  const token = req.params.token as string;
  const raw = req.headers[TICKET_HEADER];
  const ticket = Array.isArray(raw) ? raw[0] : raw;
  const valid = typeof ticket === "string" && TICKET_PATTERN.test(ticket);

  let resultadoId: number | null = null;
  if (valid) {
    // Atomic single-use consumption of the download slot of this scan session.
    const consumed = await getDatabase().exec(
      "UPDATE compartido_vistas SET descarga_used_at = NOW() WHERE ticket = ? AND token = ? AND descarga_used_at IS NULL AND expires_at > NOW() RETURNING resultado_id",
      [ticket, token]
    );
    if (consumed.length && consumed[0].values.length) resultadoId = Number(consumed[0].values[0][0]);
  }
  if (resultadoId === null) {
    if (valid && !(await isKnownToken(token))) {
      res.status(404).json({ error: "Resultado no encontrado o enlace expirado" });
      return;
    }
    res.status(410).json({ error: QR_USED_MESSAGE, codigo: "QR_USED" });
    return;
  }

  const file = await loadFile(resultadoId);
  if (!file) {
    res.status(404).json({ error: "Archivo no encontrado" });
    return;
  }

  logAcceso(req, resultadoId, "descarga_compartida");
  setPrivateHeaders(res);
  if (file.pdf) {
    res.set("Content-Type", "application/pdf");
    res.set("Content-Disposition", `attachment; filename="${file.name}"`);
    res.send(file.pdf);
    return;
  }
  res.download(file.path as string, file.name);
});

export default router;
