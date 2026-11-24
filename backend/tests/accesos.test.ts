import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/database", async () => {
  const h = await import("./mock-db");
  return { getDatabase: () => h.mockDb };
});

import accesosRouter from "../src/routes/accesos";
import { bearer, buildApp, mockDb, onExec, resetDb, table } from "./helpers";

const admin = { userId: 1, role: "admin" };
const app = () => buildApp("/api/accesos", accesosRouter);

const dataCols = [
  "id", "resultado_id", "accion", "role", "ip", "user_agent", "created_at",
  "u_nombre", "u_apellido", "u_email", "u_id", "r_id", "r_titulo", "p_nombre", "p_apellido",
];

function listCalls() {
  return mockDb.exec.mock.calls.filter(([sql]) => String(sql).includes("FROM resultado_accesos a"));
}
function dataCall() {
  return listCalls().find(([sql]) => String(sql).includes("LIMIT"))!;
}

beforeEach(() => {
  resetDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
  onExec((sql) => {
    if (sql.includes("COUNT(*) AS total")) return table(["total"], ["60"]);
    if (sql.includes("LIMIT ? OFFSET ?")) {
      return table(
        dataCols,
        [9, 3, "descarga", "paciente", "1.2.3.4", "UA", "2026-11-01T10:00:00.000Z", "Ana", "Lopez", "ana@x.com", 7, 3, "Hemograma", "Juan", "Perez"],
        [8, 4, "previsualizar", "admin", null, null, "2026-11-01T09:00:00.000Z", null, null, null, null, null, null, null, null]
      );
    }
    return undefined;
  });
});

describe("GET /api/accesos authorization", () => {
  it("401 without session", async () => {
    const res = await request(app()).get("/api/accesos");
    expect(res.status).toBe(401);
  });

  it.each(["paciente", "recepcionista", "bioanalista"])("403 for %s", async (role) => {
    const res = await request(app()).get("/api/accesos").set("Authorization", bearer({ userId: 5, role }));
    expect(res.status).toBe(403);
    const res2 = await request(app()).get("/api/accesos/resumen").set("Authorization", bearer({ userId: 5, role }));
    expect(res2.status).toBe(403);
    expect(listCalls()).toHaveLength(0);
  });

  it("200 for admin with shaped items", async () => {
    const res = await request(app()).get("/api/accesos").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ total: 60, page: 1, limit: 25 });
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0]).toMatchObject({
      id: 9,
      accion: "descarga",
      usuario: { nombre: "Ana", apellido: "Lopez", email: "ana@x.com" },
      resultado: { titulo: "Hemograma", paciente_nombre: "Juan", paciente_apellido: "Perez" },
    });
    expect(res.body.items[1].usuario).toBeNull();
    expect(res.body.items[1].resultado).toBeNull();
  });
});

describe("GET /api/accesos validation", () => {
  it.each([
    "accion=hackeo",
    "desde=2026-13-45",
    "desde=ayer",
    "hasta=2026-02-30",
    "limit=0",
    "limit=abc",
    "page=0",
    "q=" + "a".repeat(101),
  ])("400 for %s", async (qs) => {
    const res = await request(app()).get(`/api/accesos?${qs}`).set("Authorization", bearer(admin));
    expect(res.status).toBe(400);
    expect(listCalls()).toHaveLength(0);
  });

  it("accepts the previsualizacion_compartida action filter", async () => {
    const res = await request(app()).get("/api/accesos?accion=previsualizacion_compartida").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
  });

  it("rejects limit above 100 and accepts exactly 100", async () => {
    const res = await request(app()).get("/api/accesos?limit=101").set("Authorization", bearer(admin));
    expect(res.status).toBe(400);
    const ok = await request(app()).get("/api/accesos?limit=100").set("Authorization", bearer(admin));
    expect(ok.status).toBe(200);
    expect(ok.body.limit).toBe(100);
  });
});

describe("GET /api/accesos SQL safety and pagination", () => {
  it("never interpolates user text into SQL; escapes LIKE wildcards", async () => {
    const evil = "x'; DROP TABLE users;-- 50%_\\";
    const res = await request(app())
      .get("/api/accesos")
      .query({ q: evil, accion: "descarga", desde: "2026-11-01", hasta: "2026-11-30" })
      .set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(listCalls().length).toBeGreaterThan(0);
    for (const [sql, params] of listCalls()) {
      const text = String(sql);
      expect(text).not.toContain("DROP TABLE");
      expect(text).not.toContain("2026-11-01");
      expect(text).not.toContain("descarga'");
      const p = params as unknown[];
      expect(p).toContain("descarga");
      expect(p).toContain("2026-11-01");
      expect(p).toContain("2026-11-30");
      expect(p).toContain("%x'; DROP TABLE users;-- 50\\%\\_\\\\%");
    }
    // Placeholder count matches parameter count.
    const [sql, params] = dataCall();
    expect((String(sql).match(/\?/g) ?? []).length).toBe((params as unknown[]).length);
  });

  it("computes OFFSET from page and limit", async () => {
    const res = await request(app()).get("/api/accesos?page=3&limit=20").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 3, limit: 20, total: 60 });
    const params = dataCall()[1] as unknown[];
    expect(params.slice(-2)).toEqual([20, 40]);
  });

  it("defaults to page 1 / limit 25 / offset 0", async () => {
    await request(app()).get("/api/accesos").set("Authorization", bearer(admin));
    expect((dataCall()[1] as unknown[]).slice(-2)).toEqual([25, 0]);
  });
});

describe("GET /api/accesos/resumen", () => {
  it("aggregates counts, unique users and top results", async () => {
    onExec((sql) => {
      if (sql.includes("GROUP BY accion")) return table(["accion", "d30", "d7"], ["descarga", "10", "4"], ["previsualizar", "20", "6"]);
      if (sql.includes("COUNT(DISTINCT user_id)")) return table(["usuarios"], ["5"]);
      if (sql.includes("ORDER BY total DESC")) {
        return table(["resultado_id", "titulo", "paciente_nombre", "paciente_apellido", "total"], [3, "Hemograma", "Juan", "Perez", "7"]);
      }
      return undefined;
    });
    const res = await request(app()).get("/api/accesos/resumen").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.total_30_dias).toBe(30);
    expect(res.body.usuarios_unicos_30_dias).toBe(5);
    expect(res.body.ultimos_30_dias).toMatchObject({ descarga: 10, previsualizar: 20, compartir: 0, descarga_compartida: 0, previsualizacion_compartida: 0 });
    expect(res.body.ultimos_7_dias).toMatchObject({ descarga: 4, previsualizar: 6 });
    expect(res.body.mas_consultados).toEqual([
      { resultado_id: 3, titulo: "Hemograma", paciente_nombre: "Juan", paciente_apellido: "Perez", total: 7 },
    ]);
    expect(mockDb.run).not.toHaveBeenCalled();
  });
});
