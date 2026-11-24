import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/database", async () => {
  const h = await import("./mock-db");
  return { getDatabase: () => h.mockDb };
});

import { buildApp, mockDb, onExec, resetDb, table } from "./helpers";

const TOKEN = "secret-share-token";
const PDF = Buffer.from("%PDF-1.4 fake");
const QR_USED_MSG = "Este código ya fue usado. Pide uno nuevo.";
const CONSUMED_MSG = "Ya previsualizaste este documento. Vuelve a escanear el código QR para verlo de nuevo.";

type Ticket = { token: string; resultadoId: number; used: boolean; expired: boolean };
let tickets: Map<string, Ticket>;
let shareValid: boolean;
let tokenKnown: boolean;
let fileName: string;

// Fresh router per test so the module-level rate limiter never accumulates across tests.
async function app() {
  vi.resetModules();
  const { default: router } = await import("../src/routes/compartido");
  return buildApp("/api/compartido", router);
}

function logInserts() {
  return mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO resultado_accesos"));
}
function ticketInserts() {
  return mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO compartido_vistas"));
}
function consumeCalls() {
  return mockDb.exec.mock.calls.filter(([sql]) => String(sql).includes("UPDATE compartido_vistas"));
}

beforeEach(() => {
  resetDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
  tickets = new Map();
  shareValid = true;
  fileName = 'r"x.pdf';

  tokenKnown = true;
  mockDb.run.mockImplementation(async (sql, params) => {
    if (String(sql).includes("INSERT INTO compartido_vistas")) {
      const [ticket, resultadoId, token] = params as [string, number, string];
      tickets.set(ticket, { token, resultadoId, used: false, expired: false });
    }
    if (String(sql).includes("compartido_expira = NOW()")) {
      shareValid = false;
    }
  });

  onExec((sql, params) => {
    if (sql.startsWith("SELECT id FROM resultados WHERE compartido_token")) {
      return tokenKnown ? table(["id"], [3]) : [];
    }
    if (sql.includes("FROM resultados r")) {
      return shareValid
        ? table(["id", "titulo", "tipo", "archivo_nombre"], [3, "Hemograma", "laboratorio", "r.pdf"])
        : [];
    }
    if (sql.includes("FROM resultados WHERE compartido_token")) {
      return shareValid ? table(["id", "archivo_path", "archivo_nombre", "archivo_data"], [3, "/nope", fileName, PDF]) : [];
    }
    if (sql.includes("UPDATE compartido_vistas")) {
      // Emulates the single atomic UPDATE ... RETURNING semantics of the real statement.
      const [ticket, token] = params as [string, string];
      const t = tickets.get(ticket);
      if (!t || t.token !== token || t.used || t.expired) return [];
      t.used = true;
      return table(["resultado_id"], [t.resultadoId]);
    }
    return undefined;
  });
});

async function scan(a: Awaited<ReturnType<typeof app>>) {
  const res = await request(a).get(`/api/compartido/${TOKEN}`);
  return res;
}

describe("GET /api/compartido/:token ticket", () => {
  it("issues a single-use ticket with a 10 minute TTL and keeps existing fields", async () => {
    const res = await scan(await app());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, titulo: "Hemograma", preview_ttl_seconds: 600 });
    expect(res.body.ticket).toMatch(/^[0-9a-f-]{36}$/);
    expect(ticketInserts()).toHaveLength(1);
    const [sql, params] = ticketInserts()[0];
    expect(String(sql)).toContain("INTERVAL '10 minutes'");
    expect(params).toEqual([res.body.ticket, 3, TOKEN]);
  });

  it("issues a different ticket on every load", async () => {
    const a = await app();
    const one = await scan(a);
    const two = await scan(a);
    expect(one.body.ticket).not.toBe(two.body.ticket);
  });

  it("purges old tickets opportunistically", async () => {
    await scan(await app());
    const purge = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("DELETE FROM compartido_vistas"));
    expect(purge).toHaveLength(1);
  });

  it("still returns metadata (without ticket) when the ticket store fails", async () => {
    mockDb.run.mockRejectedValue(new Error("db down"));
    const res = await scan(await app());
    expect(res.status).toBe(200);
    expect(res.body.titulo).toBe("Hemograma");
    expect(res.body.ticket).toBeUndefined();
  });

  it("404 and no ticket for an unknown share token", async () => {
    shareValid = false;
    tokenKnown = false;
    const res = await scan(await app());
    expect(res.status).toBe(404);
    expect(ticketInserts()).toHaveLength(0);
  });
});

describe("POST /api/compartido/:token/previsualizar", () => {
  it("first use returns the PDF inline, uncached, and logs the access without secrets", async () => {
    fileName = 'r"\r\nx.pdf';
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["cache-control"]).toContain("no-store");
    const disposition = String(res.headers["content-disposition"]);
    expect(disposition).toMatch(/^inline; filename="[\w.\- ]+"$/);
    expect(disposition).not.toMatch(/[\r\n]/);
    expect(Buffer.from(res.body).toString()).toBe(PDF.toString());

    await vi.waitFor(() => expect(logInserts()).toHaveLength(1));
    const params = logInserts()[0][1] as unknown[];
    expect(params[0]).toBe(3);
    expect(params[3]).toBe("previsualizacion_compartida");
    const logged = JSON.stringify(params);
    expect(logged).not.toContain(ticket);
    expect(logged).not.toContain(TOKEN);
  });

  it("second use of the same ticket is 410 PREVIEW_CONSUMED", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    const again = await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(again.status).toBe(410);
    expect(again.body).toEqual({ error: CONSUMED_MSG, codigo: "PREVIEW_CONSUMED" });
    expect(logInserts()).toHaveLength(1);
  });

  it("re-scanning grants a new preview while the QR is not consumed", async () => {
    const a = await app();
    const first = (await scan(a)).body.ticket;
    const second = (await scan(a)).body.ticket;
    expect(second).not.toBe(first);
    // Each scan gets its own ticket; the first preview then consumes the whole QR.
    expect((await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket: first })).status).toBe(200);
    expect((await scan(a)).status).toBe(410);
  });

  it("unknown ticket is 410", async () => {
    const res = await request(await app())
      .post(`/api/compartido/${TOKEN}/previsualizar`)
      .send({ ticket: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(410);
    expect(res.body.codigo).toBe("PREVIEW_CONSUMED");
  });

  it("a ticket issued for another share token is 410", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await request(a).post("/api/compartido/other-token/previsualizar").send({ ticket });
    expect(res.status).toBe(410);
    expect(logInserts()).toHaveLength(0);
  });

  it("an expired ticket is 410", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    tickets.get(ticket)!.expired = true;
    const res = await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(res.status).toBe(410);
  });

  it("unknown share token is 404 and never touches tickets", async () => {
    shareValid = false;
    tokenKnown = false;
    const res = await request(await app())
      .post(`/api/compartido/${TOKEN}/previsualizar`)
      .send({ ticket: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(404);
    expect(consumeCalls()).toHaveLength(0);
  });

  it.each([
    ["missing", {}],
    ["not a string", { ticket: 123 }],
    ["too short", { ticket: "abc" }],
    ["too long", { ticket: "a".repeat(101) }],
    ["bad characters", { ticket: "abcdefgh'; DROP TABLE x;--" }],
  ])("400 for invalid body (%s)", async (_name, body) => {
    const res = await request(await app()).post(`/api/compartido/${TOKEN}/previsualizar`).send(body);
    expect(res.status).toBe(400);
    expect(consumeCalls()).toHaveLength(0);
  });

  it("consumes atomically with ONE parameterized UPDATE ... RETURNING guarded by used_at IS NULL", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(consumeCalls()).toHaveLength(1);
    const [sql, params] = consumeCalls()[0];
    const text = String(sql).replace(/\s+/g, " ");
    expect(text).toMatch(/^UPDATE compartido_vistas SET used_at = NOW\(\) WHERE .*used_at IS NULL.*expires_at > NOW\(\).* RETURNING resultado_id$/);
    expect(text).not.toContain(ticket);
    expect(params).toEqual([ticket, TOKEN]);
    // No separate read of the ticket row that could race with the consume.
    const ticketReads = mockDb.exec.mock.calls.filter(([s]) => /SELECT[^]*FROM compartido_vistas/.test(String(s)));
    expect(ticketReads).toHaveLength(0);
  });

  it("a successful preview consumes the QR: the share token is expired and a re-scan is 410 QR_USED", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(res.status).toBe(200);
    const expiring = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("compartido_expira = NOW()"));
    expect(expiring).toHaveLength(1);
    expect(expiring[0][1]).toEqual([TOKEN]);

    const again = await scan(a);
    expect(again.status).toBe(410);
    expect(again.body).toEqual({ error: QR_USED_MSG, codigo: "QR_USED" });
    expect(ticketInserts()).toHaveLength(1); // no new ticket for a used QR
    expect((await request(a).get(`/api/compartido/${TOKEN}/download`)).status).toBe(404);
  });

  it("scanning without previewing does not consume the QR", async () => {
    const a = await app();
    await scan(a);
    await scan(a);
    const expiring = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("compartido_expira = NOW()"));
    expect(expiring).toHaveLength(0);
    expect((await scan(a)).status).toBe(200);
  });

  it("a rejected ticket (410 PREVIEW_CONSUMED) does not expire the token", async () => {
    const a = await app();
    const res = await request(a)
      .post(`/api/compartido/${TOKEN}/previsualizar`)
      .send({ ticket: "00000000-0000-4000-8000-000000000000" });
    expect(res.status).toBe(410);
    const expiring = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("compartido_expira = NOW()"));
    expect(expiring).toHaveLength(0);
  });

  it("a failure to expire the token never blocks the PDF", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    mockDb.run.mockImplementation(async (sql) => {
      if (String(sql).includes("compartido_expira = NOW()")) throw new Error("expire failed");
    });
    const res = await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
  });

  it("an unknown token stays 404 (not QR_USED)", async () => {
    shareValid = false;
    tokenKnown = false;
    const res = await scan(await app());
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBeUndefined();
  });

  it("a failing access logger does not break the preview", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    mockDb.run.mockRejectedValue(new Error("insert failed"));
    const res = await request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
    expect(res.status).toBe(200);
  });
});
