import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Tenant } from "../../src/models/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

describe("tenant settings (audit H8)", () => {
  it("lets an admin update their own tenant", async () => {
    const { auth } = await createUser({ role: "admin", tenant: "acme" });
    const res = await api().put("/api/tenant").set(auth).send({ name: "Acme Inc", config: { currency: "eur" } });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ key: "acme", name: "Acme Inc", config: { currency: "EUR" } });
  });

  it("refuses to create or overwrite another tenant via body.key", async () => {
    await Tenant.create({ key: "globex", name: "Globex", status: "active" });
    const { auth } = await createUser({ role: "admin", tenant: "acme" });

    const res = await api().put("/api/tenant").set(auth).send({ key: "globex", name: "Pwned", status: "suspended" });
    expect(res.status).toBe(403);
    expect(await Tenant.findOne({ key: "globex" })).toMatchObject({ name: "Globex", status: "active" });
  });

  it("rejects unknown or invalid fields instead of writing them", async () => {
    const { auth } = await createUser({ role: "admin", tenant: "acme" });
    const res = await api().put("/api/tenant").set(auth).send({ name: "Acme", status: "root", _id: "x" });
    expect(res.status).toBe(422);
  });
});

describe("API key creation (audit M7)", () => {
  it("validates the body instead of failing with 500", async () => {
    const { auth } = await createUser({ role: "admin" });
    const res = await api().post("/api/api-keys").set(auth).send({ scopes: ["products:read"], expiresAt: "not-a-date" });
    expect(res.status).toBe(422);
    expect(res.body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(["expiresAt", "name"]);
  });

  it("creates a scoped key", async () => {
    const { auth } = await createUser({ role: "admin" });
    const res = await api().post("/api/api-keys").set(auth).send({ name: "Integration", scopes: ["products:read"] });
    expect(res.status).toBe(201);
    expect(res.body.data.key).toMatch(/^ek_[a-f0-9]{64}$/);
  });
});
