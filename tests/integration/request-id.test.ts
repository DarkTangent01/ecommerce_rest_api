import { describe, expect, it } from "vitest";
import { safeClientId } from "../../src/utils/requestContext.js";
import { api } from "../helpers/factories.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("request and correlation ids (SEC-10)", () => {
  it("always generates the request id, even when the client sends one", async () => {
    const res = await api().get("/api/health").set("X-Request-Id", "client-chosen-id");
    expect(res.headers["x-request-id"]).toMatch(UUID);
    // A valid client id survives only as the correlation id.
    expect(res.headers["x-correlation-id"]).toBe("client-chosen-id");
  });

  it("gives two requests with the same client id different request ids", async () => {
    const [a, b] = await Promise.all([1, 2].map(() => api().get("/api/health").set("X-Request-Id", "dup-id")));
    expect(a!.headers["x-request-id"]).not.toBe(b!.headers["x-request-id"]);
  });

  it("drops oversized or malformed client ids instead of echoing them", async () => {
    for (const bad of ["Z".repeat(129), "has space", "semi;colon", "quote\"d", "<script>"]) {
      const res = await api().get("/api/health").set("X-Correlation-Id", bad);
      expect(res.headers["x-correlation-id"]).toBe(res.headers["x-request-id"]);
    }
  });

  it("prefers a valid X-Correlation-Id for tracing across services", async () => {
    const res = await api().get("/api/health").set("X-Correlation-Id", "trace-123").set("X-Request-Id", "req-456");
    expect(res.headers["x-correlation-id"]).toBe("trace-123");
  });

  it("validates with a strict allowlist and length", () => {
    expect(safeClientId("abc-123_X.y:z")).toBe("abc-123_X.y:z");
    expect(safeClientId("a".repeat(128))).toHaveLength(128);
    expect(safeClientId("a".repeat(129))).toBeUndefined();
    expect(safeClientId("")).toBeUndefined();
    expect(safeClientId(["first-ok", "second"])).toBe("first-ok");
  });
});
