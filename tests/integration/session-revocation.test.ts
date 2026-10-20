import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { UserSession } from "../../src/models/index.js";
import { JwtService } from "../../src/services/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { address, api, createUser, TENANT } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const signIn = async (email: string, deviceId = "laptop-1") => {
  const res = await api().post("/api/login").set("X-Device-Id", deviceId).send({ email, password: "Password123" });
  expect(res.status).toBe(200);
  const data = res.body.data as { access_token: string; refresh_token: string };
  return { ...data, auth: { Authorization: `Bearer ${data.access_token}`, "X-Tenant-Id": TENANT } };
};

describe("session revocation (I-6, SEC-02)", () => {
  it("stops the access token immediately on logout", async () => {
    const { user } = await createUser();
    const session = await signIn(user.email);
    expect((await api().get("/api/users").set(session.auth)).status).toBe(200);

    const logout = await api().post("/api/logout").set(session.auth).send({ refresh_token: session.refresh_token });
    expect(logout.status).toBe(200);
    expect((await api().get("/api/users").set(session.auth)).status).toBe(401);
  });

  it("does not let a kept refresh token revive a signed-out session", async () => {
    const { user } = await createUser();
    const session = await signIn(user.email);
    const sid = (jwt.decode(session.access_token) as { sid: string }).sid;
    await UserSession.updateOne({ _id: sid }, { $set: { revokedAt: new Date() } });

    expect((await api().post("/api/refresh").send({ refresh_token: session.refresh_token })).status).toBe(401);
  });

  it("blocks step-up routes for a revoked session", async () => {
    const { user, session } = await createUser();
    await UserSession.updateOne({ _id: session._id }, { $set: { revokedAt: new Date() } });
    const token = JwtService.sign({ _id: user._id, role: user.role, typ: "access", sid: String(session._id) });
    const res = await api()
      .post("/api/orders/checkout")
      .set({ Authorization: `Bearer ${token}`, "X-Tenant-Id": TENANT, "Idempotency-Key": "revoked-session-0123456789" })
      .send({ shippingAddress: address });
    expect(res.status).toBe(401);
  });

  it("signs in again on the same device after a logout", async () => {
    const { user } = await createUser();
    const first = await signIn(user.email);
    await api().post("/api/logout").set(first.auth).send({ refresh_token: first.refresh_token });

    const second = await signIn(user.email);
    expect((await api().get("/api/users").set(second.auth)).status).toBe(200);
  });

  it("revokes only the signed-out session, not the user's other devices", async () => {
    const { user } = await createUser();
    const laptop = await signIn(user.email, "laptop-1");
    const phone = await signIn(user.email, "phone-1");
    await api().post("/api/logout").set(laptop.auth).send({ refresh_token: laptop.refresh_token });

    expect((await api().get("/api/users").set(laptop.auth)).status).toBe(401);
    expect((await api().get("/api/users").set(phone.auth)).status).toBe(200);
  });

  it("rejects a token whose sid is not a session id", async () => {
    const { user } = await createUser();
    const token = JwtService.sign({ _id: user._id, role: user.role, typ: "access", sid: "not-an-object-id" });
    expect((await api().get("/api/users").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });
});
