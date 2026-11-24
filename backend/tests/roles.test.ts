import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/database", async () => {
  const h = await import("./mock-db");
  return { getDatabase: () => h.mockDb };
});

import citasRouter from "../src/routes/citas";
import usersRouter from "../src/routes/users";
import analisisRouter from "../src/routes/analisis";
import resultadosRouter from "../src/routes/resultados";
import { bearer, buildApp, onExec, resetDb, table } from "./helpers";

const bio = { userId: 10, role: "bioanalista", nombre: "Ana", apellido: "Lopez" };

beforeEach(() => {
  resetDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("role matrix", () => {
  it("paciente cannot POST /citas", async () => {
    const res = await request(buildApp("/api/citas", citasRouter))
      .post("/api/citas")
      .set("Authorization", bearer({ role: "paciente" }))
      .send({ paciente_id: 1, fecha: "2030-01-01", hora_inicio: "09:00", idx: "X1", medico: "Ana Lopez", analisis_solicitados: ["hemograma"] });
    expect(res.status).toBe(403);
  });

  it("non-admin cannot GET /users", async () => {
    for (const role of ["paciente", "bioanalista", "recepcionista"]) {
      const res = await request(buildApp("/api/users", usersRouter)).get("/api/users").set("Authorization", bearer({ role }));
      expect(res.status).toBe(403);
    }
  });

  it("bioanalista cannot change an analisis of another bioanalista (analisis router)", async () => {
    onExec((sql) => (sql.includes("SELECT c.medico FROM analisis") ? table(["medico"], ["Otra Persona"]) : undefined));
    const res = await request(buildApp("/api/analisis", analisisRouter))
      .put("/api/analisis/5/estado")
      .set("Authorization", bearer(bio))
      .send({ estado: "completado" });
    expect(res.status).toBe(403);
  });

  it("bioanalista cannot change an analisis of another bioanalista (citas router)", async () => {
    onExec((sql) =>
      sql.includes("FROM analisis a JOIN citas c") ? table(["id", "cita_id", "medico"], [5, 9, "Otra Persona"]) : undefined
    );
    const res = await request(buildApp("/api/citas", citasRouter))
      .put("/api/citas/analisis/5/estado")
      .set("Authorization", bearer(bio))
      .send({ estado: "completado" });
    expect(res.status).toBe(403);
  });

  it("assigned bioanalista can change their own analisis", async () => {
    onExec((sql) => (sql.includes("SELECT c.medico FROM analisis") ? table(["medico"], ["Ana Lopez"]) : undefined));
    const res = await request(buildApp("/api/analisis", analisisRouter))
      .put("/api/analisis/5/estado")
      .set("Authorization", bearer(bio))
      .send({ estado: "completado" });
    expect(res.status).toBe(200);
  });

  describe("resultados download", () => {
    beforeEach(() => {
      onExec((sql) =>
        sql.startsWith("SELECT * FROM resultados")
          ? table(["id", "paciente_id", "archivo_nombre", "archivo_path", "archivo_data"], [3, 50, "r.pdf", "/nope", Buffer.from("%PDF-1.4")])
          : undefined
      );
      onExec((sql) => (sql.includes("SELECT user_id FROM pacientes") ? table(["user_id"], [99]) : undefined));
    });

    it("paciente cannot download another patient's resultado", async () => {
      const res = await request(buildApp("/api/resultados", resultadosRouter))
        .get("/api/resultados/download/3")
        .set("Authorization", bearer({ userId: 5, role: "paciente" }));
      expect(res.status).toBe(403);
    });

    it("paciente can download their own resultado", async () => {
      const res = await request(buildApp("/api/resultados", resultadosRouter))
        .get("/api/resultados/download/3")
        .set("Authorization", bearer({ userId: 99, role: "paciente" }));
      expect(res.status).toBe(200);
    });
  });

  describe("GET /resultados/:id/accesos", () => {
    const cols = ["id", "resultado_id", "user_id", "role", "accion", "ip", "user_agent", "created_at", "nombre", "apellido", "email"];
    const row = [1, 3, 99, "paciente", "descarga", "1.2.3.4", "ua", "2030-01-01", "Maria", "Garcia", "m@x.com"];

    it("admin can read the access log", async () => {
      onExec((sql) => (sql.startsWith("SELECT id FROM resultados") ? table(["id"], [3]) : undefined));
      onExec((sql) => (sql.includes("FROM resultado_accesos") ? table(cols, row) : undefined));
      const res = await request(buildApp("/api/resultados", resultadosRouter))
        .get("/api/resultados/3/accesos")
        .set("Authorization", bearer({ role: "admin" }));
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({ accion: "descarga", nombre: "Maria", email: "m@x.com" });
    });

    it("non-admin gets 403", async () => {
      for (const role of ["paciente", "bioanalista", "recepcionista"]) {
        const res = await request(buildApp("/api/resultados", resultadosRouter))
          .get("/api/resultados/3/accesos")
          .set("Authorization", bearer({ role }));
        expect(res.status).toBe(403);
      }
    });

    it("returns 404 when the resultado does not exist", async () => {
      const res = await request(buildApp("/api/resultados", resultadosRouter))
        .get("/api/resultados/404/accesos")
        .set("Authorization", bearer({ role: "admin" }));
      expect(res.status).toBe(404);
    });
  });
});
