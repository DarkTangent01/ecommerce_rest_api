import crypto from "crypto";
import { z } from "zod";

const SECRET_KEYS = ["JWT_SECRET", "REFRESH_SECRET", "WEBHOOK_SECRET", "SERVICE_JWT_SECRET", "SIGNED_URL_SECRET"] as const;
type SecretKey = (typeof SECRET_KEYS)[number];

const MIN_SECRET_LENGTH = 32;

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
  RESERVATION_SWEEP_SECONDS: int(60, { min: 5 }),
  CACHE_TTL_SECONDS: int(60, { min: 1 }),
  CACHE_MAX_ENTRIES: int(1000, { min: 1 }),
  REDIS_URL: z.string().trim().default(""),
  QUEUE_BACKEND: z.enum(["memory", "bullmq"]).default("memory"),
  ADMIN_IP_ALLOWLIST: z.string().default(""),
  ADMIN_IP_DENYLIST: z.string().default(""),
  SIGNED_URL_TTL_SECONDS: int(300, { min: 1 }),
  DEFAULT_TENANT: z.string().trim().toLowerCase().min(1).default("default"),
  REDIS_RATE_LIMIT_PREFIX: z.string().default("rl"),
  OTEL_SERVICE_NAME: z.string().default("ecommerce-rest-api"),
  ENABLE_QUERY_PROFILING: bool(false),
});

export type Env = Omit<z.infer<typeof baseSchema>, SecretKey | "DB_URL" | "APP_URL"> & Record<SecretKey | "DB_URL" | "APP_URL", string>;

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

  if (problems.length) throw new EnvValidationError(problems);

  const DB_URL = env.DB_URL ?? "mongodb://127.0.0.1:27017/ecommerce_rest_api";
  const APP_URL = (env.APP_URL || `http://${env.APP_IP_ADDRESS}:${env.APP_PORT}`).replace(/\/$/, "");

  return { ...env, ...secrets, DB_URL, APP_URL };
};
