import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/database", async () => {
  const h = await import("./mock-db");
  return { getDatabase: () => h.mockDb };
});

import resultadosRouter from "../src/routes/resultados";
import compartidoRouter from "../src/routes/compartido";
import { bearer, buildApp, mockDb, onExec, resetDb, table } from "./helpers";

const staff = { userId: 2, role: "recepcionista" };

function insertCalls() {
  return mockDb.run.mock.calls.filter(([sql]) => String(sql).includes("INSERT INTO resultado_accesos"));
}

beforeEach(() => {
  resetDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
  onExec((sql) =>
    sql.startsWith("SELECT * FROM resultados")
      ? table(["id", "paciente_id", "archivo_nombre", "archivo_path", "archivo_data"], [3, 50, "r.pdf", "/nope", Buffer.from("%PDF-1.4")])
      : undefined
  );
});

describe("access logging", () => {
  it("logs a 'descarga' row on download", async () => {
    const res = await request(buildApp("/api/resultados", resultadosRouter)).get("/api/resultados/download/3").set("Authorization", bearer(staff));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(insertCalls()).toHaveLength(1));
    const params = insertCalls()[0][1] as unknown[];
    expect(params.slice(0, 4)).toEqual([3, 2, "recepcionista", "descarga"]);
  });

  it("logs 'previsualizar' when ?accion=previsualizar", async () => {
    const res = await request(buildApp("/api/resultados", resultadosRouter))
      .get("/api/resultados/download/3?accion=previsualizar")
      .set("Authorization", bearer(staff));
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(insertCalls()).toHaveLength(1));
    expect((insertCalls()[0][1] as unknown[])[3]).toBe("previsualizar");
  });

  it("a failing logger does not break the download", async () => {
    mockDb.run.mockRejectedValue(new Error("insert failed"));
    const res = await request(buildApp("/api/resultados", resultadosRouter)).get("/api/resultados/download/3").set("Authorization", bearer(staff));
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/pdf");
    await vi.waitFor(() => expect(insertCalls()).toHaveLength(1));
  });

  it("a synchronously throwing logger does not break the download", async () => {
    mockDb.run.mockImplementation(() => {
      throw new Error("sync boom");
    });
    const res = await request(buildApp("/api/resultados", resultadosRouter)).get("/api/resultados/download/3").set("Authorization", bearer(staff));
    expect(res.status).toBe(200);
  });

  it("logs 'compartir' without storing the token", async () => {
    onExec((sql) => (sql.includes("SELECT user_id FROM pacientes") ? table(["user_id"], [99]) : undefined));
    const res = await request(buildApp("/api/resultados", resultadosRouter)).post("/api/resultados/3/compartir").set("Authorization", bearer(staff));
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    await vi.waitFor(() => expect(insertCalls()).toHaveLength(1));
    const params = insertCalls()[0][1] as unknown[];
    expect(params[3]).toBe("compartir");
    expect(JSON.stringify(params)).not.toContain(res.body.token);
  });

  it("logs 'descarga_compartida' on the public shared download and never the token", async () => {
    onExec((sql) =>
      sql.includes("FROM resultados WHERE compartido_token")
        ? table(["id", "archivo_path", "archivo_nombre", "archivo_data"], [3, "/nope", "r.pdf", Buffer.from("%PDF-1.4")])
        : undefined
    );
    const res = await request(buildApp("/api/compartido", compartidoRouter)).get("/api/compartido/secret-token-123/download");
    expect(res.status).toBe(200);
    await vi.waitFor(() => expect(insertCalls()).toHaveLength(1));
    const params = insertCalls()[0][1] as unknown[];
    expect(params[0]).toBe(3);
    expect(params[3]).toBe("descarga_compartida");
    expect(JSON.stringify(params)).not.toContain("secret-token-123");
  });

  it("does not log when access is denied", async () => {
    onExec((sql) => (sql.includes("SELECT user_id FROM pacientes") ? table(["user_id"], [99]) : undefined));
    const res = await request(buildApp("/api/resultados", resultadosRouter))
      .get("/api/resultados/download/3")
      .set("Authorization", bearer({ userId: 5, role: "paciente" }));
    expect(res.status).toBe(403);
    expect(insertCalls()).toHaveLength(0);
  });
});
