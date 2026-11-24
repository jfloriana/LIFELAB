import { describe, it, expect, afterEach } from "vitest";
import { isEmailConfigured } from "../src/utils/email";

const KEYS = ["EMAIL_FROM", "SMTP_HOST", "SMTP_USER", "SMTP_PASS"] as const;
const saved: Record<string, string | undefined> = {};
for (const k of KEYS) saved[k] = process.env[k];

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("isEmailConfigured", () => {
  it("is true when all SMTP variables are set", () => {
    process.env.EMAIL_FROM = "a@b.com";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    process.env.SMTP_PASS = "pass";
    expect(isEmailConfigured()).toBe(true);
  });

  it("is false when any variable is missing", () => {
    process.env.EMAIL_FROM = "a@b.com";
    process.env.SMTP_HOST = "smtp.example.com";
    process.env.SMTP_USER = "user";
    delete process.env.SMTP_PASS;
    expect(isEmailConfigured()).toBe(false);
  });

  it("is false when nothing is set", () => {
    for (const k of KEYS) delete process.env[k];
    expect(isEmailConfigured()).toBe(false);
  });
});
