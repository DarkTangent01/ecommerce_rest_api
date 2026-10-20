import jwt from "jsonwebtoken";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { JWT_SECRET } from "../../src/config/index.js";
import { RefreshToken, User, UserSession } from "../../src/models/index.js";
import { hashRefreshToken } from "../../src/repositories/AuthRepository.js";
import { JwtService } from "../../src/services/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { address, api, createUser, TENANT } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const register = async () => {
  const email = `buyer-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const res = await api()
    .post("/api/register")
    .set("X-Tenant-Id", TENANT)
    .send({ name: "Buyer", email, password: "Password123", repeat_password: "Password123" });
  expect(res.status).toBe(201);
  return { email, ...(res.body.data as { access_token: string; refresh_token: string }) };
};

describe("auth flow", () => {
  it("registers, logs in, reads the profile and logs out", async () => {
    const { email } = await register();
    const login = await api().post("/api/login").send({ email, password: "Password123" });
    expect(login.status).toBe(200);
    expect(login.body.data).toMatchObject({ step_up_required: false });

    const profile = await api().get("/api/users").set("Authorization", `Bearer ${login.body.data.access_token}`);
    expect(profile.status).toBe(200);
    expect(profile.body.data.email).toBe(email);
    expect(profile.body.data).not.toHaveProperty("password");

    const logout = await api()
      .post("/api/logout")
      .set("Authorization", `Bearer ${login.body.data.access_token}`)
      .send({ refresh_token: login.body.data.refresh_token });
    expect(logout.status).toBe(200);
    expect((await api().post("/api/refresh").send({ refresh_token: login.body.data.refresh_token })).status).toBe(401);
  });

  it("rejects wrong passwords with 401", async () => {
    const { email } = await register();
    expect((await api().post("/api/login").send({ email, password: "Wrong123x" })).status).toBe(401);
  });
});

describe("authorization uses the stored role (audit H2)", () => {
  it("ignores an admin role claim on a regular user's token", async () => {
    const { user } = await createUser({ role: "user" });
    const forged = JwtService.sign({ _id: user._id, role: "admin" });
    const res = await api().get("/api/coupons").set("Authorization", `Bearer ${forged}`).set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(403);
  });

  it("drops admin rights as soon as the user is demoted", async () => {
    const { user, auth } = await createUser({ role: "admin" });
    expect((await api().get("/api/coupons").set(auth)).status).toBe(200);
    await User.updateOne({ _id: user._id }, { $set: { role: "user" } });
    expect((await api().get("/api/coupons").set(auth)).status).toBe(403);
  });
});

describe("JWT hardening (audit M3)", () => {
  it("rejects tokens signed with a different algorithm", async () => {
    const { user } = await createUser();
    const token = jwt.sign({ _id: user._id }, JWT_SECRET, { algorithm: "HS512", issuer: "ecommerce-rest-api", audience: "ecommerce-rest-api-clients" });
    expect((await api().get("/api/users").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });

  it("rejects a refresh-typed token on access routes", async () => {
    const { user } = await createUser();
    const token = JwtService.sign({ _id: user._id, typ: "refresh" });
    expect((await api().get("/api/users").set("Authorization", `Bearer ${token}`)).status).toBe(401);
  });
});

describe("refresh tokens (audit M1, M2)", () => {
  it("stores only a hash of the refresh token", async () => {
    const { refresh_token } = await register();
    expect(await RefreshToken.countDocuments({ token: refresh_token })).toBe(0);
    expect(await RefreshToken.countDocuments({ token: hashRefreshToken(refresh_token) })).toBe(1);
  });

  it("rotates: a refresh token can be exchanged exactly once, even concurrently", async () => {
    const { refresh_token } = await register();
    const results = await Promise.all([1, 2, 3, 4].map(() => api().post("/api/refresh").send({ refresh_token })));
    expect(results.map((r) => r.status).sort()).toEqual([200, 401, 401, 401]);
  });

  it("still accepts refresh tokens stored in plaintext before hashing was introduced", async () => {
    const { user } = await createUser();
    const legacy = JwtService.sign({ _id: user._id, role: user.role }, "7d", process.env.REFRESH_SECRET);
    await RefreshToken.create({ token: hashRefreshToken("placeholder"), user: user._id, expiresAt: new Date(Date.now() + 86_400_000) });
    await RefreshToken.collection.insertOne({ token: legacy, user: user._id, expiresAt: new Date(Date.now() + 86_400_000), revokedAt: null });
    expect((await api().post("/api/refresh").send({ refresh_token: legacy })).status).toBe(200);
  });

  it("issues refresh rows that expire with the JWT", async () => {
    const { refresh_token } = await register();
    const row = await RefreshToken.findOne({ token: hashRefreshToken(refresh_token) });
    const claims = jwt.decode(refresh_token) as { exp: number };
    expect(Math.abs(row!.expiresAt.getTime() / 1000 - claims.exp)).toBeLessThan(5);
  });
});

describe("step-up authentication (audit H1, SEC-02)", () => {
  const checkoutWith = (auth: Record<string, string>, headers: Record<string, string> = {}) =>
    api()
      .post("/api/orders/checkout")
      .set(auth)
      .set(headers)
      .set("Idempotency-Key", `step-up-${Math.random().toString(36).slice(2)}-0123456789`)
      .send({ shippingAddress: address });

  it("blocks checkout from a risky session and ignores the client-controlled bypass header", async () => {
    const { auth, session } = await createUser();
    await UserSession.updateOne({ _id: session._id }, { $set: { stepUpRequired: true, riskScore: 80 } });

    const res = await checkoutWith(auth, { "X-Step-Up-Verified": "true" });
    expect(res.status).toBe(403);
    expect(res.body.message).toBe("Step-up authentication required");
  });

  it("cannot be bypassed by sending a different X-Device-Id (SEC-02)", async () => {
    const { auth, session } = await createUser();
    await UserSession.updateOne({ _id: session._id }, { $set: { stepUpRequired: true, riskScore: 80 } });

    const res = await checkoutWith(auth, { "X-Device-Id": "a-device-with-no-session" });
    expect(res.status).toBe(403);
  });

  it("fails closed for tokens without a session or with someone else's session (SEC-02)", async () => {
    const { user } = await createUser();
    const { session: otherSession } = await createUser();
    const tenantHeader = { "X-Tenant-Id": TENANT };

    const noSid = JwtService.sign({ _id: user._id, role: user.role, typ: "access" });
    expect((await checkoutWith({ ...tenantHeader, Authorization: `Bearer ${noSid}` })).status).toBe(403);

    const foreignSid = JwtService.sign({ _id: user._id, role: user.role, typ: "access", sid: String(otherSession._id) });
    expect((await checkoutWith({ ...tenantHeader, Authorization: `Bearer ${foreignSid}` })).status).toBe(403);
  });

  it("lets normal sessions through", async () => {
    const { auth } = await createUser();
    const res = await checkoutWith(auth);
    // Empty cart: past step-up and into the handler.
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Cart is empty");
  });

  it("flags a login after repeated failures and keeps blocking it on any device id (SEC-02)", async () => {
    const { user } = await createUser();
    for (let i = 0; i < 5; i++) {
      await api().post("/api/login").send({ email: user.email, password: "Wrong-password-1" });
    }
    const login = await api().post("/api/login").set("X-Device-Id", "attacker-laptop").send({ email: user.email, password: "Password123" });
    expect(login.body.data.step_up_required).toBe(true);

    const auth = { Authorization: `Bearer ${login.body.data.access_token}`, "X-Tenant-Id": TENANT };
    expect((await checkoutWith(auth, { "X-Device-Id": "attacker-laptop" })).status).toBe(403);
    expect((await checkoutWith(auth, { "X-Device-Id": "brand-new-device" })).status).toBe(403);
    expect((await checkoutWith(auth)).status).toBe(403);
  });

  it("keeps the session across refresh, including for refresh tokens issued before the sid claim", async () => {
    const { user } = await createUser();
    const login = await api().post("/api/login").send({ email: user.email, password: "Password123" });
    const sid = (jwt.decode(login.body.data.access_token) as { sid: string }).sid;

    const refreshed = await api().post("/api/refresh").send({ refresh_token: login.body.data.refresh_token });
    expect((jwt.decode(refreshed.body.data.access_token) as { sid: string }).sid).toBe(sid);
    const session = await UserSession.findById(sid);
    expect(String(session!.refreshToken)).toBe(String((await RefreshToken.findOne({ token: hashRefreshToken(refreshed.body.data.refresh_token) }))!._id));

    // A pre-SEC-02 refresh token has no sid; its session is found through the refresh token link.
    const legacy = JwtService.sign({ _id: user._id, role: user.role, typ: "refresh" }, "7d", process.env.REFRESH_SECRET);
    const row = await RefreshToken.create({ token: hashRefreshToken(legacy), user: user._id, expiresAt: new Date(Date.now() + 86_400_000) });
    await UserSession.updateOne({ _id: sid }, { $set: { refreshToken: row._id } });
    const migrated = await api().post("/api/refresh").send({ refresh_token: legacy });
    expect((jwt.decode(migrated.body.data.access_token) as { sid: string }).sid).toBe(sid);
  });
});
