import { Router } from "express";
import { query, validationResult } from "express-validator";
import { authMiddleware } from "../middleware/auth";
import { getDatabase } from "../config/database";

export const ACCIONES = ["previsualizar", "descarga", "compartir", "descarga_compartida", "previsualizacion_compartida"] as const;

const router = Router();
router.use(authMiddleware);

// Read-only audit log: admin only.
router.use((req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "No autorizado" });
    return;
  }
  next();
});

const isoDate = (field: string) =>
  query(field)
    .optional({ values: "falsy" })
    .isDate({ format: "YYYY-MM-DD", strictMode: true })
    .withMessage(`${field} inválida`);

/** Escapes LIKE wildcards so user text is matched literally. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, "\\$&");
}

type Row = Record<string, unknown>;

function toRows(result: { columns: string[]; values: unknown[][] }[]): Row[] {
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((values) => {
    const obj: Row = {};
    cols.forEach((col, i) => {
      obj[col] = values[i];
    });
    return obj;
  });
}

const FROM_JOINS = `
  FROM resultado_accesos a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN resultados r ON r.id = a.resultado_id
  LEFT JOIN pacientes p ON p.id = r.paciente_id
  LEFT JOIN users pu ON pu.id = p.user_id`;

const LIKE_ESCAPE = "ESCAPE '\\'";

router.get(
  "/",
  query("accion").optional({ values: "falsy" }).isIn([...ACCIONES]).withMessage("accion inválida"),
  query("q").optional({ values: "falsy" }).isString().trim().isLength({ max: 100 }).withMessage("q demasiado largo"),
  isoDate("desde"),
  isoDate("hasta"),
  query("page").optional().isInt({ min: 1, max: 1000000 }).withMessage("page inválido").toInt(),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("limit inválido").toInt(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ error: errors.array()[0].msg });
      return;
    }
    const q = req.query as Record<string, unknown>;
    const page = (q.page as number | undefined) ?? 1;
    const limit = (q.limit as number | undefined) ?? 25;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (q.accion) {
      conditions.push("a.accion = ?");
      params.push(q.accion);
    }
    if (q.desde) {
      conditions.push("a.created_at >= ?::date");
      params.push(q.desde);
    }
    if (q.hasta) {
      // Inclusive of the whole "hasta" day.
      conditions.push("a.created_at < (?::date + INTERVAL '1 day')");
      params.push(q.hasta);
    }
    if (typeof q.q === "string" && q.q.length > 0) {
      const pattern = `%${escapeLike(q.q)}%`;
      const like = (col: string) => `${col} ILIKE ? ${LIKE_ESCAPE}`;
      conditions.push(
        `(${[
          like("u.nombre"),
          like("u.apellido"),
          like("u.email"),
          like("(u.nombre || ' ' || u.apellido)"),
          like("r.titulo"),
        ].join(" OR ")})`
      );
      params.push(pattern, pattern, pattern, pattern, pattern);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    try {
      const db = getDatabase();
      const countRows = toRows(await db.exec(`SELECT COUNT(*) AS total ${FROM_JOINS} ${where}`, params));
      const total = Number(countRows[0]?.total ?? 0);

      const dataRows = toRows(
        await db.exec(
          `SELECT a.id, a.resultado_id, a.accion, a.role, a.ip, a.user_agent, a.created_at,
                  u.nombre AS u_nombre, u.apellido AS u_apellido, u.email AS u_email, u.id AS u_id,
                  r.id AS r_id, r.titulo AS r_titulo,
                  pu.nombre AS p_nombre, pu.apellido AS p_apellido
           ${FROM_JOINS} ${where}
           ORDER BY a.created_at DESC, a.id DESC
           LIMIT ? OFFSET ?`,
          [...params, limit, (page - 1) * limit]
        )
      );

      const items = dataRows.map((row) => ({
        id: row.id,
        resultado_id: row.resultado_id,
        accion: row.accion,
        role: row.role,
        ip: row.ip,
        user_agent: row.user_agent,
        created_at: row.created_at,
        usuario: row.u_id == null ? null : { nombre: row.u_nombre, apellido: row.u_apellido, email: row.u_email },
        resultado:
          row.r_id == null ? null : { titulo: row.r_titulo, paciente_nombre: row.p_nombre, paciente_apellido: row.p_apellido },
      }));

      res.json({ items, total, page, limit });
    } catch (err) {
      console.error("Error al listar accesos:", (err as Error)?.message);
      res.status(500).json({ error: "Error interno del servidor" });
    }
  }
);

function emptyCounts(): Record<string, number> {
  return Object.fromEntries(ACCIONES.map((a) => [a, 0]));
}

router.get("/resumen", async (_req, res) => {
  try {
    const db = getDatabase();
    const porAccion = toRows(
      await db.exec(
        `SELECT accion,
                COUNT(*) AS d30,
                COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days') AS d7
         FROM resultado_accesos
         WHERE created_at >= NOW() - INTERVAL '30 days'
         GROUP BY accion`
      )
    );
    const unicos = toRows(
      await db.exec(
        "SELECT COUNT(DISTINCT user_id) AS usuarios FROM resultado_accesos WHERE created_at >= NOW() - INTERVAL '30 days'"
      )
    );
    const top = toRows(
      await db.exec(
        `SELECT a.resultado_id, r.titulo, pu.nombre AS paciente_nombre, pu.apellido AS paciente_apellido, COUNT(*) AS total
         FROM resultado_accesos a
         LEFT JOIN resultados r ON r.id = a.resultado_id
         LEFT JOIN pacientes p ON p.id = r.paciente_id
         LEFT JOIN users pu ON pu.id = p.user_id
         WHERE a.created_at >= NOW() - INTERVAL '30 days'
         GROUP BY a.resultado_id, r.titulo, pu.nombre, pu.apellido
         ORDER BY total DESC, a.resultado_id DESC
         LIMIT 5`
      )
    );

    const ultimos7 = emptyCounts();
    const ultimos30 = emptyCounts();
    let total30 = 0;
    for (const row of porAccion) {
      const accion = String(row.accion);
      if (!(accion in ultimos30)) continue;
      ultimos30[accion] = Number(row.d30);
      ultimos7[accion] = Number(row.d7);
      total30 += Number(row.d30);
    }

    res.json({
      ultimos_7_dias: ultimos7,
      ultimos_30_dias: ultimos30,
      total_30_dias: total30,
      usuarios_unicos_30_dias: Number(unicos[0]?.usuarios ?? 0),
      mas_consultados: top.map((row) => ({
        resultado_id: row.resultado_id,
        titulo: row.titulo,
        paciente_nombre: row.paciente_nombre,
        paciente_apellido: row.paciente_apellido,
        total: Number(row.total),
      })),
    });
  } catch (err) {
    console.error("Error al resumir accesos:", (err as Error)?.message);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;
