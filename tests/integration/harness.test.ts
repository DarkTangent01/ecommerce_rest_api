import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDb, stopDb } from "../helpers/db.js";
import { api, createProduct, TENANT } from "../helpers/factories.js";

describe("integration harness", () => {
  beforeAll(() => startDb());
  afterAll(() => stopDb());

  it("reports ready once the database is connected", async () => {
    const res = await api().get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "ready", database: "connected" });
  });

  it("serves products from the in-memory database", async () => {
    const product = await createProduct();
    const res = await api().get("/api/products").set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(200);
    expect(res.body.data.map((p: { _id: string }) => p._id)).toContain(String(product._id));
  });
});
