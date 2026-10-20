import bcrypt from "bcrypt";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());
afterEach(() => vi.restoreAllMocks());

const login = (email: string, password: string) => api().post("/api/login").send({ email, password });
// Only the parts a client sees; request ids differ per request by design.
const visible = (res: { status: number; body: Record<string, unknown> }) => ({ status: res.status, body: res.body });

describe("account enumeration (SEC-09)", () => {
  it("answers an unknown email exactly like a wrong password", async () => {
    const { user } = await createUser();
    const wrongPassword = await login(user.email, "Wrong-password-1");
    const unknownEmail = await login("nobody-here@example.com", "Wrong-password-1");
    expect(wrongPassword.status).toBe(401);
    expect(visible(unknownEmail)).toEqual(visible(wrongPassword));
  });

  it("runs a password comparison for unknown emails too", async () => {
    const compare = vi.spyOn(bcrypt, "compare");
    await login("nobody-here@example.com", "Wrong-password-1");
    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0]![1]).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  it("keeps working for the real account", async () => {
    const { user } = await createUser();
    expect((await login(user.email, "Password123")).status).toBe(200);
  });
});
