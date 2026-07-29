import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types";
import { getDatabase } from "../config/database";

export function getUser(req: Request): JwtPayload {
  if (!req.user) {
    throw new Error("Usuario no autenticado — falta authMiddleware");
  }
  return req.user;
}

const JWT_SECRET: string = process.env.JWT_SECRET!;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está configurada en el archivo .env");
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "2h" });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    token = header.slice(7);
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    res.status(401).json({ error: "Token no proporcionado" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    // Verify token version matches DB (skip for refresh endpoint, handled there)
    if (decoded.tokenVersion !== undefined) {
      try {
        const db = getDatabase();
        const userResult = await db.exec(
          "SELECT token_version FROM users WHERE id = ?",
          [decoded.userId]
        );
        if (userResult.length && userResult[0].values.length) {
          const currentVersion = userResult[0].values[0][0] as number;
          if (decoded.tokenVersion < currentVersion) {
            res.status(401).json({ error: "Sesión expirada. Inicia sesión nuevamente." });
            return;
          }
        }
      } catch { /* si la BD falla, permitimos el paso por tolerancia */ }
    }
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado" });
  }
}
