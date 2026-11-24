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
const UNKNOWN_TICKET = "00000000-0000-4000-8000-000000000000";

type Ticket = { token: string; resultadoId: number; previewUsed: boolean; downloadUsed: boolean; expired: boolean };
let tickets: Map<string, Ticket>;
// State of the share token itself, emulating the single atomic scan UPDATE.
let tokenKnown: boolean;
let tokenExpired: boolean;
let scanned: boolean;
let fileName: string;

// Fresh router per test so the module-level rate limiter never accumulates across tests.
async function app() {
  vi.resetModules();
  const { default: router } = await import("../src/routes/compartido");
  return buildApp("/api/compartido", router);
}

const sqlOf = (call: unknown[]) => String(call[0]).replace(/\s+/g, " ");
function logInserts() {
  return mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO resultado_accesos"));
}
function ticketInserts() {
  return mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO compartido_vistas"));
}
function scanCalls() {
  return mockDb.exec.mock.calls.filter(([sql]) => String(sql).includes("SET compartido_escaneado_at"));
}
function previewConsumes() {
  return mockDb.exec.mock.calls.filter(([sql]) => /SET used_at = NOW\(\)/.test(String(sql)));
}
function downloadConsumes() {
  return mockDb.exec.mock.calls.filter(([sql]) => String(sql).includes("SET descarga_used_at = NOW()"));
}

beforeEach(() => {
  resetDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
  tickets = new Map();
  tokenKnown = true;
  tokenExpired = false;
  scanned = false;
  fileName = 'r"x.pdf';

  mockDb.run.mockImplementation(async (sql, params) => {
    if (String(sql).includes("INSERT INTO compartido_vistas")) {
      const [ticket, resultadoId, token] = params as [string, number, string];
      tickets.set(ticket, { token, resultadoId, previewUsed: false, downloadUsed: false, expired: false });
    }
  });

  onExec((sql, params) => {
    if (sql.includes("SET compartido_escaneado_at")) {
      // Emulates the single atomic UPDATE ... IS NULL ... RETURNING of the real statement.
      if (!tokenKnown || tokenExpired || scanned || (params as string[])[0] !== TOKEN) return [];
      scanned = true;
      return table(["id"], [3]);
    }
    if (sql.startsWith("SELECT id FROM resultados WHERE compartido_token")) {
      return tokenKnown && (params as string[])[0] === TOKEN ? table(["id"], [3]) : [];
    }
    if (sql.includes("FROM resultados r")) {
      return table(["id", "titulo", "tipo", "archivo_nombre"], [3, "Hemograma", "laboratorio", "r.pdf"]);
    }
    if (sql.includes("FROM resultados WHERE id")) {
      return table(["id", "archivo_path", "archivo_nombre", "archivo_data"], [3, "/nope", fileName, PDF]);
    }
    if (sql.includes("UPDATE compartido_vistas")) {
      const [ticket, token] = params as [string, string];
      const t = tickets.get(ticket);
      if (!t || t.token !== token || t.expired) return [];
      if (sql.includes("descarga_used_at")) {
        if (t.downloadUsed) return [];
        t.downloadUsed = true;
      } else {
        if (t.previewUsed) return [];
        t.previewUsed = true;
      }
      return table(["resultado_id"], [t.resultadoId]);
    }
    return undefined;
  });
});

const scan = (a: Awaited<ReturnType<typeof app>>) => request(a).get(`/api/compartido/${TOKEN}`);
const preview = (a: Awaited<ReturnType<typeof app>>, ticket: unknown) =>
  request(a).post(`/api/compartido/${TOKEN}/previsualizar`).send({ ticket });
const download = (a: Awaited<ReturnType<typeof app>>, ticket?: string, token = TOKEN) => {
  const req = request(a).get(`/api/compartido/${token}/download`);
  return ticket ? req.set("X-Compartido-Ticket", ticket) : req;
};

describe("GET /api/compartido/:token (the one and only scan)", () => {
  it("first GET scans the QR and returns metadata plus a session ticket with a 10 minute TTL", async () => {
    const res = await scan(await app());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: 3, titulo: "Hemograma", preview_ttl_seconds: 600 });
    expect(res.body.ticket).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers["cache-control"]).toContain("no-store");
    expect(scanned).toBe(true);
    expect(ticketInserts()).toHaveLength(1);
    const [sql, params] = ticketInserts()[0];
    expect(String(sql)).toContain("INTERVAL '10 minutes'");
    expect(params).toEqual([res.body.ticket, 3, TOKEN]);
  });

  it("second GET of the same token is 410 QR_USED and issues no ticket", async () => {
    const a = await app();
    expect((await scan(a)).status).toBe(200);
    const again = await scan(a);
    expect(again.status).toBe(410);
    expect(again.body).toEqual({ error: QR_USED_MSG, codigo: "QR_USED" });
    expect(ticketInserts()).toHaveLength(1);
  });

  it("an expired token that exists is 410 QR_USED", async () => {
    tokenExpired = true;
    const res = await scan(await app());
    expect(res.status).toBe(410);
    expect(res.body.codigo).toBe("QR_USED");
    expect(ticketInserts()).toHaveLength(0);
  });

  it("an unknown token is 404 (no codigo) and issues no ticket", async () => {
    tokenKnown = false;
    const res = await scan(await app());
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBeUndefined();
    expect(ticketInserts()).toHaveLength(0);
  });

  it("scans atomically with ONE parameterized UPDATE ... RETURNING guarded by IS NULL and expiry", async () => {
    await scan(await app());
    expect(scanCalls()).toHaveLength(1);
    const [, params] = scanCalls()[0];
    const text = sqlOf(scanCalls()[0]);
    expect(text).toMatch(/^UPDATE resultados SET compartido_escaneado_at = NOW\(\) WHERE compartido_token = \? AND .*compartido_expira > NOW\(\).* AND compartido_escaneado_at IS NULL RETURNING id$/);
    expect(text).not.toContain(TOKEN);
    expect(params).toEqual([TOKEN]);
  });

  it("issues a different ticket for every scan session (tokens re-generated)", async () => {
    const a = await app();
    const one = await scan(a);
    scanned = false; // a new share token would reset the flag
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
});

describe("POST /api/compartido/:token/previsualizar", () => {
  it("returns the PDF inline once per session, uncached, and logs the access without secrets", async () => {
    fileName = 'r"\r\nx.pdf';
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await preview(a, ticket);
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

  it("second preview with the same session is 410 PREVIEW_CONSUMED", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await preview(a, ticket);
    const again = await preview(a, ticket);
    expect(again.status).toBe(410);
    expect(again.body).toEqual({ error: CONSUMED_MSG, codigo: "PREVIEW_CONSUMED" });
    expect(logInserts()).toHaveLength(1);
  });

  it("works although the share token was already scanned (the scan is what consumed it)", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    expect(scanned).toBe(true);
    expect((await preview(a, ticket)).status).toBe(200);
  });

  it("never expires or modifies the share token", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await preview(a, ticket);
    const touched = mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("UPDATE resultados"));
    expect(touched).toHaveLength(0);
  });

  it("an unknown ticket is 410 for a known token", async () => {
    const res = await preview(await app(), UNKNOWN_TICKET);
    expect(res.status).toBe(410);
    expect(res.body.codigo).toBe("PREVIEW_CONSUMED");
  });

  it("a ticket issued for another share token is 410 and never logs", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await request(a).post("/api/compartido/other-token/previsualizar").send({ ticket });
    expect([404, 410]).toContain(res.status);
    expect(logInserts()).toHaveLength(0);
  });

  it("an expired session is 410", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    tickets.get(ticket)!.expired = true;
    const res = await preview(a, ticket);
    expect(res.status).toBe(410);
    expect(logInserts()).toHaveLength(0);
  });

  it("unknown share token is 404", async () => {
    tokenKnown = false;
    const res = await preview(await app(), UNKNOWN_TICKET);
    expect(res.status).toBe(404);
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
    expect(previewConsumes()).toHaveLength(0);
  });

  it("consumes atomically with ONE parameterized UPDATE ... RETURNING guarded by used_at IS NULL", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await preview(a, ticket);
    expect(previewConsumes()).toHaveLength(1);
    const [, params] = previewConsumes()[0];
    const text = sqlOf(previewConsumes()[0]);
    expect(text).toMatch(/^UPDATE compartido_vistas SET used_at = NOW\(\) WHERE .*used_at IS NULL.*expires_at > NOW\(\).* RETURNING resultado_id$/);
    expect(text).not.toContain(ticket);
    expect(params).toEqual([ticket, TOKEN]);
    const ticketReads = mockDb.exec.mock.calls.filter(([s]) => /SELECT[^]*FROM compartido_vistas/.test(String(s)));
    expect(ticketReads).toHaveLength(0);
  });

  it("a failing access logger does not break the preview", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    mockDb.run.mockRejectedValue(new Error("insert failed"));
    const res = await preview(a, ticket);
    expect(res.status).toBe(200);
  });
});

describe("GET /api/compartido/:token/download (needs the scan session)", () => {
  it("the share token alone cannot fetch the PDF, even before any scan", async () => {
    const res = await download(await app());
    expect(res.status).toBe(410);
    expect(res.body).toEqual({ error: QR_USED_MSG, codigo: "QR_USED" });
    expect(logInserts()).toHaveLength(0);
    expect(res.body.toString()).not.toContain("%PDF");
  });

  it("a malformed ticket header is 410 without touching the database", async () => {
    const res = await download(await app(), "x'; DROP TABLE y;--");
    expect(res.status).toBe(410);
    expect(downloadConsumes()).toHaveLength(0);
  });

  it("downloads the PDF with a valid session, sanitized filename and no-store", async () => {
    fileName = 'r"\r\nx.pdf';
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await download(a, ticket);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    expect(res.headers["cache-control"]).toContain("no-store");
    const disposition = String(res.headers["content-disposition"]);
    expect(disposition).toMatch(/^attachment; filename="[\w.\- ]+"$/);
    expect(Buffer.from(res.body).toString()).toBe(PDF.toString());
  });

  it("one download per session: the second is 410 QR_USED", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    expect((await download(a, ticket)).status).toBe(200);
    const again = await download(a, ticket);
    expect(again.status).toBe(410);
    expect(again.body.codigo).toBe("QR_USED");
  });

  it("the same session allows one preview AND one download, independently", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    expect((await preview(a, ticket)).status).toBe(200);
    expect((await download(a, ticket)).status).toBe(200);
    expect((await preview(a, ticket)).status).toBe(410);
    expect((await download(a, ticket)).status).toBe(410);
  });

  it("an expired session is 410", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    tickets.get(ticket)!.expired = true;
    expect((await download(a, ticket)).status).toBe(410);
  });

  it("a ticket for another share token cannot download", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    const res = await download(a, ticket, "other-token");
    expect([404, 410]).toContain(res.status);
    expect(res.body.toString()).not.toContain("%PDF");
  });

  it("unknown share token with a well-formed ticket is 404", async () => {
    tokenKnown = false;
    expect((await download(await app(), UNKNOWN_TICKET)).status).toBe(404);
  });

  it("consumes atomically with ONE parameterized UPDATE ... RETURNING guarded by descarga_used_at IS NULL", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await download(a, ticket);
    expect(downloadConsumes()).toHaveLength(1);
    const [, params] = downloadConsumes()[0];
    const text = sqlOf(downloadConsumes()[0]);
    expect(text).toMatch(/^UPDATE compartido_vistas SET descarga_used_at = NOW\(\) WHERE .*descarga_used_at IS NULL.*expires_at > NOW\(\).* RETURNING resultado_id$/);
    expect(text).not.toContain(ticket);
    expect(params).toEqual([ticket, TOKEN]);
  });

  it("logs descarga_compartida without ticket or token", async () => {
    const a = await app();
    const { ticket } = (await scan(a)).body;
    await download(a, ticket);
    await vi.waitFor(() => expect(logInserts()).toHaveLength(1));
    const params = logInserts()[0][1] as unknown[];
    expect(params[0]).toBe(3);
    expect(params[3]).toBe("descarga_compartida");
    const logged = JSON.stringify(params);
    expect(logged).not.toContain(ticket);
    expect(logged).not.toContain(TOKEN);
  });
});
