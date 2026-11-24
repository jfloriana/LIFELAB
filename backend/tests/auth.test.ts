import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";

vi.mock("../src/config/database", async () => {
  const h = await import("./mock-db");
  return { getDatabase: () => h.mockDb };
});

import { authMiddleware } from "../src/middleware/auth";
import { bearer, mockDb, onExec, resetDb, table } from "./helpers";

function app() {
  const a = express();
  a.use(cookieParser());
  a.get("/protected", authMiddleware, (req, res) => {
    res.json({ userId: req.user!.userId });
  });
  return a;
}

describe("authMiddleware", () => {
  beforeEach(() => {
    resetDb();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("returns 401 without a token", async () => {
    const res = await request(app()).get("/protected");
    expect(res.status).toBe(401);
  });

  it("returns 401 for a malformed token", async () => {
    const res = await request(app()).get("/protected").set("Authorization", "Bearer nonsense");
    expect(res.status).toBe(401);
  });

  it("lets a valid token through", async () => {
    const res = await request(app()).get("/protected").set("Authorization", bearer({ userId: 7, role: "paciente" }));
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(7);
  });

  it("returns 401 when the token version is older than the DB version", async () => {
    onExec((sql) => (sql.includes("token_version FROM users") ? table(["token_version"], [3]) : undefined));
    const res = await request(app()).get("/protected").set("Authorization", bearer({ role: "paciente", tokenVersion: 1 }));
    expect(res.status).toBe(401);
  });

  it("fails closed with 503 when the DB lookup throws", async () => {
    mockDb.exec.mockRejectedValue(new Error("db down"));
    const res = await request(app()).get("/protected").set("Authorization", bearer({ role: "admin" }));
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: "Servicio no disponible, intenta de nuevo" });
  });
});
