import express from "express";
import cookieParser from "cookie-parser";
import type { Router } from "express";
import { generateToken } from "../src/middleware/auth";

export { mockDb, onExec, resetDb, table } from "./mock-db";

export type TestUser = {
  userId: number;
  nombre: string;
  apellido: string;
  email: string;
  role: string;
  tokenVersion: number;
};

export function bearer(user: Partial<TestUser> & { role: string }): string {
  const token = generateToken({
    userId: 1,
    nombre: "Test",
    apellido: "User",
    email: "test@example.com",
    tokenVersion: 0,
    ...user,
  });
  return `Bearer ${token}`;
}

/** Bare express app with a real router mounted (no server is started, index.ts is never imported). */
export function buildApp(mountPath: string, router: Router) {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use(mountPath, router);
  return app;
}
