import { describe, expect, it } from "vitest";
import { EnvValidationError, parseEnv } from "../../src/config/env.schema.js";

const strong = (label: string) => `${label}-${"x".repeat(40)}`;

const productionEnv = {
  NODE_ENV: "production",
  DB_URL: "mongodb://db:27017/shop",
  JWT_SECRET: strong("access"),
  REFRESH_SECRET: strong("refresh"),
  WEBHOOK_SECRET: strong("webhook"),
  SERVICE_JWT_SECRET: strong("service"),
  SIGNED_URL_SECRET: strong("signed"),
};

const silent = { onWarning: () => undefined };

const problemsFor = (source: Record<string, string>) => {
  try {
    parseEnv(source, silent);
    return [];
  } catch (err) {
    expect(err).toBeInstanceOf(EnvValidationError);
    return (err as EnvValidationError).problems;
  }
};

describe("parseEnv", () => {
  it("accepts a complete production configuration", () => {
    const env = parseEnv(productionEnv, silent);
    expect(env.NODE_ENV).toBe("production");
    expect(env.DEBUG_MODE).toBe(false);
  });

  it("requires every secret in production (audit C1: webhook/service/signed-url were optional)", () => {
    const { WEBHOOK_SECRET: _w, SERVICE_JWT_SECRET: _s, SIGNED_URL_SECRET: _u, ...rest } = productionEnv;
    expect(problemsFor(rest)).toEqual([
      "WEBHOOK_SECRET: is required in production",
      "SERVICE_JWT_SECRET: is required in production",
      "SIGNED_URL_SECRET: is required in production",
    ]);
  });

  it("rejects published placeholder secrets in every environment", () => {
    expect(problemsFor({ NODE_ENV: "development", WEBHOOK_SECRET: "replace-this-webhook-secret" })).toEqual([
      "WEBHOOK_SECRET: is a published placeholder value; generate a real secret",
    ]);
  });

  it("rejects short or reused secrets in production", () => {
    expect(problemsFor({ ...productionEnv, JWT_SECRET: "short" })).toContain("JWT_SECRET: must be at least 32 characters in production");
    expect(problemsFor({ ...productionEnv, REFRESH_SECRET: productionEnv.JWT_SECRET })).toContain("REFRESH_SECRET: must differ from JWT_SECRET");
  });

  it("uses random, distinct secrets in development instead of fixed placeholders", () => {
    const warnings: string[] = [];
    const a = parseEnv({}, { onWarning: (m) => warnings.push(m) });
    const b = parseEnv({}, silent);
    expect(a.WEBHOOK_SECRET).not.toBe(b.WEBHOOK_SECRET);
    expect(a.JWT_SECRET).not.toBe(a.REFRESH_SECRET);
    expect(warnings).toHaveLength(5);
  });

  it("defaults DEBUG_MODE to false so stack traces are not leaked (audit H10)", () => {
    expect(parseEnv({ NODE_ENV: "development" }, silent).DEBUG_MODE).toBe(false);
  });

  it("validates numeric and enum values", () => {
    expect(problemsFor({ APP_PORT: "70000" })[0]).toMatch(/^APP_PORT:/);
    expect(problemsFor({ NODE_ENV: "prod" })[0]).toMatch(/^NODE_ENV:/);
    expect(problemsFor({ ACCESS_TOKEN_TTL: "soon" })[0]).toMatch(/^ACCESS_TOKEN_TTL:/);
  });

  it("treats empty values as unset", () => {
    expect(parseEnv({ APP_PORT: "", REDIS_URL: "" }, silent)).toMatchObject({ APP_PORT: 5000, REDIS_URL: "" });
  });

  describe("TRUST_PROXY (SEC-01)", () => {
    it("is off by default, so X-Forwarded-For is ignored", () => {
      expect(parseEnv({}, silent).TRUST_PROXY).toBe(false);
      expect(parseEnv({ TRUST_PROXY: "false" }, silent).TRUST_PROXY).toBe(false);
    });

    it("accepts a hop count or proxy addresses, subnets and presets", () => {
      expect(parseEnv({ TRUST_PROXY: "1" }, silent).TRUST_PROXY).toBe(1);
      expect(parseEnv({ TRUST_PROXY: "loopback, 10.0.0.0/8, fd00::/8, 192.0.2.1" }, silent).TRUST_PROXY).toEqual([
        "loopback",
        "10.0.0.0/8",
        "fd00::/8",
        "192.0.2.1",
      ]);
    });

    it("refuses 'true', oversized hop counts and malformed entries", () => {
      expect(problemsFor({ TRUST_PROXY: "true" })[0]).toMatch(/^TRUST_PROXY: must not be true/);
      expect(problemsFor({ TRUST_PROXY: "50" })[0]).toMatch(/^TRUST_PROXY: hop count/);
      expect(problemsFor({ TRUST_PROXY: "loopback,10.0.0.0/33,proxy.internal" })[0]).toBe(
        "TRUST_PROXY: invalid entries: 10.0.0.0/33, proxy.internal (use loopback, linklocal, uniquelocal, IPs or CIDRs)"
      );
    });
  });

  it("refuses DEBUG_MODE in production (SEC-13)", () => {
    expect(problemsFor({ ...productionEnv, DEBUG_MODE: "true" })).toEqual(["DEBUG_MODE: must be false in production"]);
    expect(parseEnv({ NODE_ENV: "development", DEBUG_MODE: "true" }, silent).DEBUG_MODE).toBe(true);
  });
});
