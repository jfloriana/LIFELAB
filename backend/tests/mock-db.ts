import { vi } from "vitest";

type ExecResult = { columns: string[]; values: unknown[][] }[];
type Handler = (sql: string, params?: unknown[]) => ExecResult | undefined;

/** Fake database: tests register SQL handlers; no real connection is ever opened. */
export const mockDb = {
  exec: vi.fn<(sql: string, params?: unknown[]) => Promise<ExecResult>>(),
  run: vi.fn<(sql: string, params?: unknown[]) => Promise<void>>(),
};

let handlers: Handler[] = [];

/** Later handlers take precedence over earlier ones; return undefined to pass. */
export function onExec(handler: Handler) {
  handlers.push(handler);
}

export function resetDb() {
  handlers = [];
  mockDb.exec.mockReset();
  mockDb.run.mockReset();
  mockDb.run.mockResolvedValue(undefined);
  mockDb.exec.mockImplementation(async (sql, params) => {
    for (const h of [...handlers].reverse()) {
      const out = h(sql, params);
      if (out !== undefined) return out;
    }
    if (sql.includes("token_version FROM users")) {
      return [{ columns: ["token_version"], values: [[0]] }];
    }
    return [];
  });
}

export function table(columns: string[], ...rows: unknown[][]): ExecResult {
  return [{ columns, values: rows }];
}
