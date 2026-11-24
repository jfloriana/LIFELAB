import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/database", async () => {
  const h = await import("./mock-db");
  return { getDatabase: () => h.mockDb };
});

import resultadosRouter from "../src/routes/resultados";
import accesosRouter from "../src/routes/accesos";
import { bearer, buildApp, mockDb, onExec, resetDb, table } from "./helpers";

const HOUR = 3600 * 1000;
const MIN = 60 * 1000;

const admin = { userId: 1, role: "admin" };
const staff = { userId: 2, role: "recepcionista" };
const owner = { userId: 99, role: "paciente" };

type LogRow = { resultadoId: number; accion: string; at: number; userId: number | null };

let log: LogRow[];
let now: number;
let resultadoExists: boolean;
let shareActive: boolean;

const resultados = () => buildApp("/api/resultados", resultadosRouter);
const accesos = () => buildApp("/api/accesos", accesosRouter);

function inserts(accion?: string) {
  return log.filter((r) => (accion ? r.accion === accion : true));
}

/** Emulates the window SQL: 'compartir' rows in the last 2h and after the latest 'desbloqueo_qr'. */
function windowOf(resultadoId: number) {
  const mine = log.filter((r) => r.resultadoId === resultadoId);
  const unlock = Math.max(-Infinity, ...mine.filter((r) => r.accion === "desbloqueo_qr").map((r) => r.at));
  const counted = mine.filter((r) => r.accion === "compartir" && r.at > now - 2 * HOUR && r.at > unlock);
  const oldest = counted.length ? Math.min(...counted.map((r) => r.at)) : null;
  return { generados: counted.length, reintento: oldest === null ? null : (oldest + 2 * HOUR - now) / 1000 };
}

async function compartir(user: { userId: number; role: string }, id = 3) {
  return request(resultados()).post(`/api/resultados/${id}/compartir`).set("Authorization", bearer(user));
}

function seed(count: number, at: number, id = 3) {
  for (let i = 0; i < count; i++) log.push({ resultadoId: id, accion: "compartir", at, userId: 2 });
}

beforeEach(() => {
  resetDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
  log = [];
  now = Date.UTC(2026, 10, 1, 12, 0, 0);
  resultadoExists = true;
  shareActive = true;

  mockDb.run.mockImplementation(async (sql, params) => {
    if (String(sql).includes("INSERT INTO resultado_accesos")) {
      const p = params as [number, number | null, string | null, string];
      log.push({ resultadoId: p[0], userId: p[1], accion: p[3], at: now });
    }
  });

  onExec((sql, params) => {
    if (sql.includes("COUNT(*) AS generados") && !sql.includes("HAVING")) {
      const { generados, reintento } = windowOf(Number((params as unknown[])[0]));
      return table(["generados", "reintento"], [String(generados), reintento === null ? null : String(reintento)]);
    }
    if (sql.includes("AS activo")) {
      return resultadoExists ? table(["id", "paciente_id", "activo"], [3, 50, shareActive]) : [];
    }
    if (sql.startsWith("SELECT * FROM resultados")) {
      return resultadoExists ? table(["id", "paciente_id"], [3, 50]) : [];
    }
    if (sql.startsWith("SELECT id FROM resultados WHERE id")) {
      return resultadoExists ? table(["id"], [3]) : [];
    }
    if (sql.includes("SELECT user_id FROM pacientes")) return table(["user_id"], [99]);
    return undefined;
  });
});

describe("POST /api/resultados/:id/compartir generation limit", () => {
  it("allows the 5th generation (counter in the response) and blocks the 6th with 429 QR_LIMIT", async () => {
    for (let n = 1; n <= 5; n++) {
      const res = await compartir(staff);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ generados: n, restantes: 5 - n, limite: 5 });
      now += 1 * MIN;
    }
    const blocked = await compartir(staff);
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ codigo: "QR_LIMIT", limite: 5, ventana_horas: 2 });
    expect(blocked.body.token).toBeUndefined();
    expect(inserts("compartir")).toHaveLength(5);
    // The blocked attempt must not touch the share token.
    const tokenUpdates = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("SET compartido_token"));
    expect(tokenUpdates).toHaveLength(5);
  });

  it("reports the seconds until the OLDEST counted generation leaves the 2h window", async () => {
    const t0 = now;
    seed(1, t0);
    seed(4, t0 + 20 * MIN);
    now = t0 + 30 * MIN;
    const res = await compartir(staff);
    expect(res.status).toBe(429);
    expect(res.body.reintento_en_segundos).toBe(90 * 60);
    expect(res.body.error).toBe("Alcanzaste el límite de códigos QR. Inténtalo de nuevo en 90 minutos.");
  });

  it("logs a qr_bloqueado access row when blocking", async () => {
    seed(5, now - 10 * MIN);
    await compartir(staff);
    await vi.waitFor(() => expect(inserts("qr_bloqueado")).toHaveLength(1));
    expect(inserts("qr_bloqueado")[0]).toMatchObject({ resultadoId: 3, userId: 2 });
  });

  it("counts only the 2h window: older generations do not count", async () => {
    seed(4, now - 2 * HOUR - 1 * MIN);
    seed(4, now - 10 * MIN);
    const ok = await compartir(staff);
    expect(ok.status).toBe(200);
    expect(ok.body.generados).toBe(5);
    expect((await compartir(staff)).status).toBe(429);
  });

  it("a generation becomes available again once the oldest leaves the window", async () => {
    seed(5, now - 2 * HOUR + 5 * MIN);
    expect((await compartir(staff)).status).toBe(429);
    now += 6 * MIN;
    expect((await compartir(staff)).status).toBe(200);
  });

  it("the limit is per resultado", async () => {
    seed(5, now - MIN, 4);
    expect((await compartir(staff, 3)).status).toBe(200);
  });

  it("admin is NOT unlimited", async () => {
    seed(5, now - MIN);
    const res = await compartir(admin);
    expect(res.status).toBe(429);
    expect(res.body.codigo).toBe("QR_LIMIT");
  });

  it("the owner patient follows the same limit", async () => {
    seed(5, now - MIN);
    expect((await compartir(owner)).status).toBe(429);
  });

  it("does not leak the limit state to a user without access", async () => {
    seed(5, now - MIN);
    const res = await compartir({ userId: 5, role: "paciente" });
    expect(res.status).toBe(403);
    expect(inserts("qr_bloqueado")).toHaveLength(0);
  });

  it("an unlock resets the counter: only generations after the last desbloqueo_qr count", async () => {
    seed(5, now - 30 * MIN);
    expect((await compartir(staff)).status).toBe(429);
    now += 1 * MIN;
    expect((await request(resultados()).post("/api/resultados/3/qr/desbloquear").set("Authorization", bearer(admin))).status).toBe(200);
    now += 1 * MIN;
    for (let n = 1; n <= 5; n++) {
      const res = await compartir(staff);
      expect(res.status).toBe(200);
      expect(res.body.generados).toBe(n);
      now += 1 * MIN;
    }
    expect((await compartir(staff)).status).toBe(429);
  });

  it("an unlock of one resultado does not affect another", async () => {
    seed(5, now - 30 * MIN, 3);
    seed(5, now - 30 * MIN, 4);
    log.push({ resultadoId: 4, accion: "desbloqueo_qr", at: now - MIN, userId: 1 });
    expect((await compartir(staff, 3)).status).toBe(429);
  });

  it("uses parameterized SQL for the window count", async () => {
    await compartir(staff);
    const call = mockDb.exec.mock.calls.find(([sql]) => String(sql).includes("COUNT(*) AS generados"))!;
    expect(call[1]).toEqual([3, 3]);
    expect(String(call[0])).not.toContain("= 3");
  });
});

describe("GET /api/resultados/:id/compartir/estado", () => {
  const estado = (user: { userId: number; role: string }, id = 3) =>
    request(resultados()).get(`/api/resultados/${id}/compartir/estado`).set("Authorization", bearer(user));

  it("401 without a session", async () => {
    expect((await request(resultados()).get("/api/resultados/3/compartir/estado")).status).toBe(401);
  });

  it("reports an active, unblocked QR with the counter", async () => {
    seed(2, now - 10 * MIN);
    const res = await estado(owner);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ activo: true, generados: 2, restantes: 3, limite: 5, bloqueado: false, reintento_en_segundos: null });
  });

  it("reports an inactive (consumed) QR", async () => {
    shareActive = false;
    const res = await estado(staff);
    expect(res.body.activo).toBe(false);
  });

  it("reports blocked state with the retry time", async () => {
    seed(5, now - 30 * MIN);
    const res = await estado(staff);
    expect(res.body).toMatchObject({ generados: 5, restantes: 0, bloqueado: true, reintento_en_segundos: 90 * 60 });
  });

  it("only counts the window after the last unlock", async () => {
    seed(5, now - 30 * MIN);
    log.push({ resultadoId: 3, accion: "desbloqueo_qr", at: now - 5 * MIN, userId: 1 });
    const res = await estado(admin);
    expect(res.body).toMatchObject({ generados: 0, restantes: 5, bloqueado: false, reintento_en_segundos: null });
  });

  it("403 for a patient that does not own the resultado, 404 for a missing one", async () => {
    expect((await estado({ userId: 5, role: "paciente" })).status).toBe(403);
    resultadoExists = false;
    expect((await estado(staff)).status).toBe(404);
  });

  it("is read-only: never writes", async () => {
    await estado(staff);
    expect(mockDb.run).not.toHaveBeenCalled();
  });

  it("400 for an invalid id", async () => {
    expect((await estado(staff, 0)).status).toBe(400);
  });
});

describe("POST /api/resultados/:id/qr/desbloquear", () => {
  const unlock = (user: { userId: number; role: string }, id = 3) =>
    request(resultados()).post(`/api/resultados/${id}/qr/desbloquear`).set("Authorization", bearer(user));

  it.each(["recepcionista", "bioanalista", "paciente"])("403 for %s and nothing is written", async (role) => {
    const res = await unlock({ userId: 99, role });
    expect(res.status).toBe(403);
    expect(inserts("desbloqueo_qr")).toHaveLength(0);
  });

  it("404 for a missing resultado", async () => {
    resultadoExists = false;
    const res = await unlock(admin);
    expect(res.status).toBe(404);
    expect(inserts("desbloqueo_qr")).toHaveLength(0);
  });

  it("admin gets {ok:true} and the unlock is recorded with the admin identity", async () => {
    const res = await unlock(admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(inserts("desbloqueo_qr")).toEqual([{ resultadoId: 3, accion: "desbloqueo_qr", at: now, userId: 1 }]);
  });

  it("500 (not a false ok) when the unlock cannot be recorded", async () => {
    mockDb.run.mockRejectedValue(new Error("db down"));
    const res = await unlock(admin);
    expect(res.status).toBe(500);
    expect(res.body.ok).toBeUndefined();
  });
});

describe("accesos: new actions and blocked list", () => {
  it.each(["qr_bloqueado", "desbloqueo_qr"])("accepts the %s filter", async (accion) => {
    const res = await request(accesos()).get(`/api/accesos?accion=${accion}`).set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
  });

  it("the summary counts include the new actions", async () => {
    onExec((sql) => (sql.includes("GROUP BY accion") ? table(["accion", "d30", "d7"], ["qr_bloqueado", "3", "1"], ["desbloqueo_qr", "2", "2"]) : undefined));
    const res = await request(accesos()).get("/api/accesos/resumen").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body.ultimos_30_dias).toMatchObject({ qr_bloqueado: 3, desbloqueo_qr: 2 });
    expect(res.body.total_30_dias).toBe(5);
  });

  it("GET /qr-bloqueados is admin only", async () => {
    expect((await request(accesos()).get("/api/accesos/qr-bloqueados")).status).toBe(401);
    for (const role of ["paciente", "recepcionista", "bioanalista"]) {
      const res = await request(accesos()).get("/api/accesos/qr-bloqueados").set("Authorization", bearer({ userId: 5, role }));
      expect(res.status).toBe(403);
    }
  });

  it("GET /qr-bloqueados lists blocked resultados with the retry time", async () => {
    onExec((sql) =>
      sql.includes("HAVING COUNT(*) >= 5")
        ? table(
            ["resultado_id", "titulo", "paciente_nombre", "paciente_apellido", "generados", "reintento"],
            [3, "Hemograma", "Juan", "Perez", "5", "4321.2"]
          )
        : undefined
    );
    const res = await request(accesos()).get("/api/accesos/qr-bloqueados").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { resultado_id: 3, titulo: "Hemograma", paciente_nombre: "Juan", paciente_apellido: "Perez", generados: 5, reintento_en_segundos: 4322 },
    ]);
  });

  it("GET /qr-bloqueados returns an empty list when nothing is blocked", async () => {
    const res = await request(accesos()).get("/api/accesos/qr-bloqueados").set("Authorization", bearer(admin));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});
