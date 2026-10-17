import { describe, expect, it } from "vitest";
import { isOriginAllowed, parseOriginList } from "../../src/utils/cors.js";

describe("isOriginAllowed (audit M13)", () => {
  it("always allows requests without an Origin header", () => {
    expect(isOriginAllowed(undefined, [], "production")).toBe(true);
  });

  it("denies cross-origin requests in production when no allowlist is configured", () => {
    expect(isOriginAllowed("https://evil.example", [], "production")).toBe(false);
  });

  it("keeps the permissive default for local development", () => {
    expect(isOriginAllowed("http://localhost:5173", [], "development")).toBe(true);
  });

  it("enforces a configured allowlist everywhere", () => {
    const allowlist = parseOriginList(" https://shop.example , https://admin.example ");
    expect(isOriginAllowed("https://shop.example", allowlist, "production")).toBe(true);
    expect(isOriginAllowed("https://evil.example", allowlist, "development")).toBe(false);
  });
});
