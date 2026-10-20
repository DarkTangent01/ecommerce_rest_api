import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Order, Tenant, User } from "../../src/models/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser, TENANT } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

let n = 0;
const register = (tenant: string) =>
  api()
    .post("/api/register")
    .set("X-Tenant-Id", tenant)
    .send({ name: "New Buyer", email: `buyer-${Date.now()}-${n++}@example.com`, password: "Password123", repeat_password: "Password123" });

describe("tenant self-registration (SEC-07)", () => {
  it("allows sign-up in an existing, active, open tenant", async () => {
    const res = await register(TENANT);
    expect(res.status).toBe(201);
    expect(await User.findOne({ tenant: TENANT })).not.toBeNull();
  });

  it("allows sign-up in the default storefront before a Tenant record exists", async () => {
    expect(await Tenant.exists({ key: "default" })).toBeNull();
    expect((await register("default")).status).toBe(201);
  });

  it("refuses unknown, suspended and closed tenants with one indistinguishable answer", async () => {
    await Tenant.create({ key: "suspended-co", name: "Suspended", status: "suspended" });
    await Tenant.create({ key: "private-co", name: "Private", status: "active", config: { allowSelfSignup: false } });

    const responses = await Promise.all(["victim-corp", "suspended-co", "private-co"].map(register));
    for (const res of responses) {
      expect(res.status).toBe(403);
      expect(res.body.message).toBe("Registration is not available for this store");
    }
    expect(await User.countDocuments({ tenant: { $in: ["victim-corp", "suspended-co", "private-co"] } })).toBe(0);
    // No tenant is created as a side effect.
    expect(await Tenant.exists({ key: "victim-corp" })).toBeNull();
  });

  it("refuses the default storefront once it is suspended", async () => {
    await Tenant.create({ key: "default", name: "Main store", status: "suspended" });
    expect((await register("default")).status).toBe(403);
  });

  it("lets an admin close self-sign-up for their tenant", async () => {
    const { auth } = await createUser({ role: "admin" });
    expect((await api().put("/api/tenant").set(auth).send({ name: "Acme", config: { allowSelfSignup: false } })).status).toBe(200);
    expect((await register(TENANT)).status).toBe(403);
  });

  it("keeps signed-in users in their own tenant whatever X-Tenant-Id says", async () => {
    await Tenant.create({ key: "globex", name: "Globex", status: "active" });
    const acmeBuyer = await createUser();
    const product = await createProduct();
    await addToCart(acmeBuyer.auth, product._id);
    const orderId = (await checkout(acmeBuyer.auth)).body.data._id as string;

    const globexBuyer = await createUser({ tenant: "globex" });
    const spoofed = { ...globexBuyer.auth, "X-Tenant-Id": TENANT };
    expect((await api().get(`/api/orders/${orderId}`).set(spoofed)).status).toBe(404);
    expect((await api().get("/api/orders").set(spoofed)).body.data).toEqual([]);
    expect(await Order.countDocuments({ tenant: "globex" })).toBe(0);
  });
});
