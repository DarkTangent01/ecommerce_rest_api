import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/server.js";
import { authLimiter } from "../../src/middlewares/rateLimiters.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const failLogin = (email: string, ip: string) =>
  api().post("/api/login").set("X-Forwarded-For", ip).send({ email, password: "Wrong-password-1" });

describe("client IP and X-Forwarded-For (SEC-01)", () => {
  it("does not trust X-Forwarded-For unless TRUST_PROXY is set", () => {
    expect(app.get("trust proxy")).toBe(false);
  });

  it("keeps the login limit when every attempt claims a different X-Forwarded-For", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // A different email each time, so only the IP limiter can trip.
      statuses.push((await failLogin(`nobody-${i}@example.com`, `192.0.2.${i + 1}`)).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("limits failed logins per account even when they are spread over many IPs", async () => {
    const { user } = await createUser();
    const statuses: number[] = [];
    for (let i = 0; i < 11; i++) {
      // Stands in for an attacker rotating real source addresses: clear the per-IP budget each time.
      for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) authLimiter.resetKey(ip);
      statuses.push((await failLogin(user.email, `198.51.100.${i + 1}`)).status);
    }
    expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  it("does not count successful logins against the account", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 9; i++) {
      for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) authLimiter.resetKey(ip);
      const res = await api().post("/api/login").send({ email: user.email, password: "Password123" });
      expect(res.status).toBe(200);
    }
    for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) authLimiter.resetKey(ip);
    expect((await failLogin(user.email, "198.51.100.1")).status).toBe(401);
  });
});
