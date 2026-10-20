import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/server.js";

describe("error responses", () => {
  it("answers malformed JSON with 400 and no stack trace", async () => {
    const res = await request(app).post("/api/login").set("Content-Type", "application/json").send("{bad");
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, data: null, error: { code: "BAD_REQUEST", message: "Malformed JSON body" } });
    expect(JSON.stringify(res.body)).not.toContain("stack");
  });

  it("answers oversized bodies with 413", async () => {
    const res = await request(app).post("/api/login").send({ email: "a@example.com", password: "x".repeat(200 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("answers unknown routes with the standard envelope", async () => {
    const res = await request(app).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      message: "Route not found",
      data: null,
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  it("puts validation details under error.details (and the legacy top-level details)", async () => {
    const res = await request(app).post("/api/login").send({ email: "bad", password: "x" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_FAILED");
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: "email" })]);
    expect(res.body.details).toEqual(res.body.error.details);
  });

  it("includes error: null on success", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toMatchObject({ success: true, error: null });
  });

  it("reports not-ready with 503 while the database is disconnected (audit M11)", async () => {
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ success: false, error: { code: "SERVICE_UNAVAILABLE", details: { database: "disconnected" } } });
  });
});
