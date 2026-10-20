import crypto from "crypto";
import net from "net";
import { z } from "zod";

const SECRET_KEYS = ["JWT_SECRET", "REFRESH_SECRET", "WEBHOOK_SECRET", "SERVICE_JWT_SECRET", "SIGNED_URL_SECRET"] as const;
type SecretKey = (typeof SECRET_KEYS)[number];

const MIN_SECRET_LENGTH = 32;

/** Express `trust proxy` value: false, a hop count, or a list of proxy addresses/subnets. */
export type TrustProxy = false | number | string[];

const TRUST_PROXY_PRESETS = new Set(["loopback", "linklocal", "uniquelocal"]);

const isAddressOrSubnet = (value: string) => {
  const [address = "", bits, ...extra] = value.split("/");
  const version = net.isIP(address);
  if (!version || extra.length) return false;
  if (bits === undefined) return true;
  return /^\d+$/.test(bits) && Number(bits) <= (version === 4 ? 32 : 128);
};

/**
 * Parses TRUST_PROXY. Off by default: when the app is reachable without a proxy, trusting
 * X-Forwarded-For lets every client choose its own IP for rate limits and the admin allowlist
 * (SEC-01). "true" (trust every hop) is refused for the same reason.
 */
export const parseTrustProxy = (raw: string): TrustProxy | { error: string } => {
  const value = raw.trim().toLowerCase();
  if (value === "" || value === "false" || value === "0") return false;
  if (value === "true") return { error: "must not be true (that trusts any client); use a hop count or proxy addresses" };
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    return hops <= 10 ? hops : { error: "hop count must be 10 or less" };
  }
  const entries = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const invalid = entries.filter((entry) => !TRUST_PROXY_PRESETS.has(entry) && !isAddressOrSubnet(entry));
  if (invalid.length) return { error: `invalid entries: ${invalid.join(", ")} (use loopback, linklocal, uniquelocal, IPs or CIDRs)` };
  return entries;
};

// Values that have shipped in this repo's code or .env.example. Anyone can read them, so they are never accepted.
const KNOWN_PLACEHOLDERS = new Set([
  "change-this-access-token-secret",
  "change-this-refresh-token-secret",
  "replace-this-webhook-secret",
  "replace-this-service-token-secret",
  "replace-this-signed-url-secret",
  "replace-with-a-long-random-access-token-secret",
  "replace-with-a-different-long-random-refresh-token-secret",
  "replace-with-a-long-random-webhook-signing-secret",
  "replace-with-a-long-random-service-auth-secret",
  "replace-with-a-long-random-signed-url-secret",
]);

const int = (fallback: number, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) =>
  z.coerce.number().int().min(min).max(max).default(fallback);

const bool = (fallback: boolean) =>
  z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1")
    .default(fallback);

const optionalSecret = z.string().trim().optional();

const baseSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: int(5000, { min: 0, max: 65535 }),
  APP_IP_ADDRESS: z.string().trim().min(1).default("127.0.0.1"),
  APP_URL: z.string().trim().optional(),
  DEBUG_MODE: bool(false),
  /** Serve /openapi.json without authentication in production (I-4). */
  EXPOSE_OPENAPI: bool(false),
  DB_URL: z.string().trim().optional(),
  JWT_SECRET: optionalSecret,
  REFRESH_SECRET: optionalSecret,
  WEBHOOK_SECRET: optionalSecret,
  SERVICE_JWT_SECRET: optionalSecret,
  SIGNED_URL_SECRET: optionalSecret,
  ACCESS_TOKEN_TTL: z.string().trim().regex(/^\d+[smhdw]$/, "must look like 30s, 15m, 12h, 7d or 2w").default("15m"),
  REFRESH_TOKEN_TTL: z.string().trim().regex(/^\d+[smhdw]$/, "must look like 30s, 15m, 12h, 7d or 2w").default("7d"),
  CORS_ORIGIN: z.string().trim().default(""),
  REQUEST_BODY_LIMIT: z.string().trim().min(1).default("100kb"),
  UPLOAD_MAX_BYTES: int(5 * 1024 * 1024, { min: 1 }),
  BCRYPT_ROUNDS: int(12, { min: 4, max: 15 }),
  IDEMPOTENCY_TTL_HOURS: int(24, { min: 1 }),
  INVENTORY_RESERVATION_MINUTES: int(15, { min: 1 }),
  REFUND_WINDOW_DAYS: int(30, { min: 1, max: 365 }),
  SSE_MAX_STREAMS_PER_USER: int(3, { min: 1, max: 50 }),
  SSE_MAX_STREAMS: int(1000, { min: 1 }),
  SSE_MAX_LIFETIME_SECONDS: int(3600, { min: 30 }),
  SSE_HEARTBEAT_SECONDS: int(25, { min: 1 }),
  RESERVATION_SWEEP_SECONDS: int(60, { min: 5 }),
  CACHE_TTL_SECONDS: int(60, { min: 1 }),
  CACHE_MAX_ENTRIES: int(1000, { min: 1 }),
  REDIS_URL: z.string().trim().default(""),
  QUEUE_BACKEND: z.enum(["memory", "bullmq"]).default("memory"),
  TRUST_PROXY: z.string().default("false"),
  /** Comma-separated payment providers whose signed webhooks are accepted (SEC-11). */
  WEBHOOK_PROVIDERS: z.string().trim().toLowerCase().default("manual"),
  ADMIN_IP_ALLOWLIST: z.string().default(""),
  ADMIN_IP_DENYLIST: z.string().default(""),
  SIGNED_URL_TTL_SECONDS: int(300, { min: 1 }),
  DEFAULT_TENANT: z.string().trim().toLowerCase().min(1).default("default"),
  REDIS_RATE_LIMIT_PREFIX: z.string().default("rl"),
  OTEL_SERVICE_NAME: z.string().default("ecommerce-rest-api"),
  ENABLE_QUERY_PROFILING: bool(false),
});

export type Env = Omit<z.infer<typeof baseSchema>, SecretKey | "DB_URL" | "APP_URL" | "TRUST_PROXY"> &
  Record<SecretKey | "DB_URL" | "APP_URL", string> & { TRUST_PROXY: TrustProxy };

export class EnvValidationError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n  - ${problems.join("\n  - ")}`);
    this.name = "EnvValidationError";
  }
}

/**
 * Parses and validates configuration. Throws EnvValidationError listing every problem.
 * Production requires real secrets; elsewhere a missing secret gets a random per-process value
 * (never a publicly known placeholder), so tokens and signatures stop working across restarts.
 */
export const parseEnv = (source: NodeJS.ProcessEnv, { onWarning = console.warn }: { onWarning?: (message: string) => void } = {}): Env => {
  // Treat empty strings as unset so `KEY=` in a .env file falls back to the default.
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== ""));
  const parsed = baseSchema.safeParse(cleaned);
  if (!parsed.success) {
    throw new EnvValidationError(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }

  const env = parsed.data;
  const isProduction = env.NODE_ENV === "production";
  const problems: string[] = [];

  const secrets = {} as Record<SecretKey, string>;
  for (const key of SECRET_KEYS) {
    const value = env[key];
    if (!value) {
      if (isProduction) {
        problems.push(`${key}: is required in production`);
      } else {
        onWarning(`[config] ${key} is not set; using a random per-process value (${env.NODE_ENV} only).`);
      }
      secrets[key] = crypto.randomBytes(48).toString("hex");
      continue;
    }
    if (KNOWN_PLACEHOLDERS.has(value)) {
      problems.push(`${key}: is a published placeholder value; generate a real secret`);
    } else if (isProduction && value.length < MIN_SECRET_LENGTH) {
      problems.push(`${key}: must be at least ${MIN_SECRET_LENGTH} characters in production`);
    }
    secrets[key] = value;
  }

  // Distinct signing keys stop a refresh/service token from verifying as an access token.
  const seen = new Map<string, SecretKey>();
  for (const key of SECRET_KEYS) {
    const other = seen.get(secrets[key]);
    if (other) problems.push(`${key}: must differ from ${other}`);
    seen.set(secrets[key], key);
  }

  if (!env.DB_URL && isProduction) problems.push("DB_URL: is required in production");
  // Debug mode puts stack traces in 5xx responses (SEC-13).
  if (isProduction && env.DEBUG_MODE) problems.push("DEBUG_MODE: must be false in production");

  const TRUST_PROXY = parseTrustProxy(env.TRUST_PROXY);
  if (typeof TRUST_PROXY === "object" && !Array.isArray(TRUST_PROXY)) problems.push(`TRUST_PROXY: ${TRUST_PROXY.error}`);

  if (problems.length) throw new EnvValidationError(problems);

  const DB_URL = env.DB_URL ?? "mongodb://127.0.0.1:27017/ecommerce_rest_api";
  const APP_URL = (env.APP_URL || `http://${env.APP_IP_ADDRESS}:${env.APP_PORT}`).replace(/\/$/, "");

  return { ...env, ...secrets, DB_URL, APP_URL, TRUST_PROXY: TRUST_PROXY as TrustProxy };
};
