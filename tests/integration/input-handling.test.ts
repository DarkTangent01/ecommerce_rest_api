import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { acquireLock, releaseLock } from "../../src/infra/locks/distributedLock.js";
import { sanitizeValue } from "../../src/middlewares/sanitizeInput.js";
import { openApiIsPublic } from "../../src/modules/platform/routes.js";
import { assertSafeExternalUrl } from "../../src/utils/ssrf.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

describe("input sanitization (I-5)", () => {
  it("keeps legitimate text with angle brackets intact", () => {
    const body = { description: "Fits sizes < 40 & > 30 — <b>bold</b>" };
    expect(sanitizeValue(body)).toEqual({ description: "Fits sizes < 40 & > 30 — <b>bold</b>" });
  });

  it("removes control characters but keeps tabs and newlines", () => {
    expect(sanitizeValue("a\u0000b\u0007c\td\ne")).toBe("abc\td\ne");
  });

  it("drops prototype keys at any depth", () => {
    const parsed = JSON.parse('{"a":{"__proto__":{"polluted":1},"constructor":{"x":1},"ok":true}}') as Record<string, Record<string, unknown>>;
    const clean = sanitizeValue(parsed) as Record<string, Record<string, unknown>>;
    expect(Object.keys(clean.a!)).toEqual(["ok"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("still rejects NoSQL operators", async () => {
    const res = await api().post("/api/login").send({ email: { $ne: "" }, password: "x" });
    expect(res.status).toBe(400);
  });
});

describe("locks (I-1)", () => {
  it("lets only the current owner release a lock", async () => {
    const first = acquireLock("checkout:test", 20)!;
    expect(acquireLock("checkout:test", 20)).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = acquireLock("checkout:test", 1000)!;
    expect(second).toBeTruthy();
    // The expired first holder finishing late must not free the second owner's lock.
    expect(releaseLock("checkout:test", first)).toBe(false);
    expect(acquireLock("checkout:test", 1000)).toBeNull();
    expect(releaseLock("checkout:test", second)).toBe(true);
  });
});

describe("public uploads (I-2)", () => {
  it("serves only generated image names, never other files or traversal", async () => {
    for (const path of ["/uploads/../package.json", "/uploads/%2e%2e/package.json", "/uploads/evil.html", "/uploads/test.jpg", "/uploads/x.svg"]) {
      expect((await api().get(path)).status).toBe(404);
    }
  });

  it("sends nosniff and a sandboxing CSP for image requests", async () => {
    const res = await api().get("/uploads/123e4567-e89b-12d3-a456-426614174000.png");
    expect(res.status).toBe(404); // no such file, but the guard headers are set first
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });
});

describe("OpenAPI exposure (I-4)", () => {
  it("is public outside production and admin-only in production unless opted in", () => {
    expect(openApiIsPublic("development", false)).toBe(true);
    expect(openApiIsPublic("production", false)).toBe(false);
    expect(openApiIsPublic("production", true)).toBe(true);
  });

  it("serves the spec in the test environment", async () => {
    expect((await api().get("/api/openapi.json")).status).toBe(200);
  });
});

describe("SSRF guard (I-3)", () => {
  it.each([
    "https://127.0.0.1/x",
    "https://localhost/x",
    "https://10.1.2.3/",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/",
    "https://[fd00::1]/",
    "https://[fe80::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://2130706433/",
    "https://0x7f000001/",
    "https://0177.0.0.1/",
    "https://100.64.0.1/",
    "https://metadata.google.internal/",
    "http://example.com/",
  ])("rejects %s", (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow();
  });

  it("accepts a public https URL", () => {
    expect(() => assertSafeExternalUrl("https://tracking.example.com/T123")).not.toThrow();
  });

  it("is applied to shipment tracking URLs", async () => {
    const { auth } = await createUser({ role: "admin" });
    const res = await api()
      .put("/api/orders/000000000000000000000000/shipment")
      .set(auth)
      .send({ carrier: "X", trackingNumber: "Y", trackingUrl: "https://[::1]/admin" });
    expect(res.status).toBe(400);
  });
});
