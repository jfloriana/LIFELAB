import { getDatabase } from "../config/database";
import crypto from "crypto";

export interface User {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  role: string;
  token_version?: number;
  email_verified?: boolean;
  email_verification_token?: string;
  created_at: string;
}

export async function findUserByEmail(email: string): Promise<User | undefined> {
  const db = getDatabase();
  const result = await db.exec("SELECT id, nombre, apellido, email, password, role, token_version, email_verified, email_verification_token, created_at FROM users WHERE email = ?", [email]);
  if (!result.length || !result[0].values.length) return undefined;

  const row = result[0].values[0];
  const cols = result[0].columns;
  const user: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => {
    user[col] = row[i];
  });

  return user as unknown as User;
}

export async function findUserById(id: number): Promise<User | undefined> {
  const db = getDatabase();
  const result = await db.exec(
    "SELECT id, nombre, apellido, email, role, token_version, created_at FROM users WHERE id = ?",
    [id]
  );
  if (!result.length || !result[0].values.length) return undefined;

  const row = result[0].values[0];
  const cols = result[0].columns;
  const user: Record<string, unknown> = {};
  cols.forEach((col: string, i: number) => {
    user[col] = row[i];
  });

  return user as unknown as User;
}

export async function createUser(
  nombre: string,
  apellido: string,
  email: string,
  password: string,
): Promise<User> {
  const db = getDatabase();
  const result = await db.exec(
    "INSERT INTO users (nombre, apellido, email, password, role, email_verified, email_verification_token) VALUES (?, ?, ?, ?, 'paciente', FALSE, ?) RETURNING id",
    [nombre, apellido, email, password, crypto.randomBytes(32).toString("hex")]
  );
  const id = result[0].values[0][0] as number;

  const pExists = await db.exec("SELECT id FROM pacientes WHERE user_id = ?", [id]);
  if (!pExists.length || !pExists[0].values.length) {
    await db.run("INSERT INTO pacientes (user_id) VALUES (?)", [id]);
  }

  return (await findUserById(id))!;
}
