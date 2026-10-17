import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/server.js";

// Routes that respond without touching MongoDB.
describe("platform routes (no database)", () => {
  it("serves health on both mount points", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect((await request(app).get("/api/v1/health")).status).toBe(200);
  });

  it("serves the OpenAPI document", async () => {
    const res = await request(app).get("/api/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.0.3");
  });

  it("sets security headers and a request id", async () => {
    const res = await request(app).get("/api/platform/security-headers");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("rejects duplicate query parameters", async () => {
    const res = await request(app).get("/api/products?x=1&x=2");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("requires auth for /users", async () => {
    expect((await request(app).get("/api/users")).status).toBe(401);
  });

  it("validates login payloads", async () => {
    const res = await request(app).post("/api/login").send({ email: "bad", password: "x" });
    expect(res.status).toBe(422);
    expect(res.body.message).toBe("Validation failed");
  });

  it("rejects unsigned payment webhooks", async () => {
    const res = await request(app)
      .post("/api/payments/webhook")
      .set("X-Webhook-Event-Id", "evt_test")
      .send({ orderId: "507f1f77bcf86cd799439011", type: "payment.succeeded" });
    expect(res.status).toBe(401);
  });
});
