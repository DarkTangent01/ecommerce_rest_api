import dotenv from "dotenv";
dotenv.config();

const required = ["DB_URL", "JWT_SECRET", "REFRESH_SECRET"];

if (process.env.NODE_ENV === "production") {
  required.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const APP_PORT = toInt(process.env.APP_PORT, 5000);
export const APP_IP_ADDRESS = process.env.APP_IP_ADDRESS || "127.0.0.1";
export const APP_URL = (process.env.APP_URL || `http://${APP_IP_ADDRESS}:${APP_PORT}`).replace(/\/$/, "");
export const NODE_ENV = process.env.NODE_ENV || "development";
export const DEBUG_MODE = toBool(process.env.DEBUG_MODE, NODE_ENV !== "production");
export const DB_URL = process.env.DB_URL || "mongodb://127.0.0.1:27017/ecommerce_rest_api";
export const JWT_SECRET = process.env.JWT_SECRET || "change-this-access-token-secret";
export const REFRESH_SECRET = process.env.REFRESH_SECRET || "change-this-refresh-token-secret";
export const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || "15m";
export const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || "7d";
export const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
export const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || "100kb";
export const UPLOAD_MAX_BYTES = toInt(process.env.UPLOAD_MAX_BYTES, 5 * 1024 * 1024);
export const BCRYPT_ROUNDS = toInt(process.env.BCRYPT_ROUNDS, 12);
export const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "replace-this-webhook-secret";
export const IDEMPOTENCY_TTL_HOURS = toInt(process.env.IDEMPOTENCY_TTL_HOURS, 24);
export const INVENTORY_RESERVATION_MINUTES = toInt(process.env.INVENTORY_RESERVATION_MINUTES, 15);
export const CACHE_TTL_SECONDS = toInt(process.env.CACHE_TTL_SECONDS, 60);
export const REDIS_URL = process.env.REDIS_URL || "";
export const QUEUE_BACKEND = process.env.QUEUE_BACKEND || "memory";
export const SERVICE_JWT_SECRET = process.env.SERVICE_JWT_SECRET || "replace-this-service-token-secret";
export const ADMIN_IP_ALLOWLIST = process.env.ADMIN_IP_ALLOWLIST || "";
export const ADMIN_IP_DENYLIST = process.env.ADMIN_IP_DENYLIST || "";
export const SIGNED_URL_SECRET = process.env.SIGNED_URL_SECRET || "replace-this-signed-url-secret";
export const SIGNED_URL_TTL_SECONDS = toInt(process.env.SIGNED_URL_TTL_SECONDS, 300);
export const DEFAULT_TENANT = process.env.DEFAULT_TENANT || "default";
export const REDIS_RATE_LIMIT_PREFIX = process.env.REDIS_RATE_LIMIT_PREFIX || "rl";
export const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || "ecommerce-rest-api";
export const ENABLE_QUERY_PROFILING = toBool(process.env.ENABLE_QUERY_PROFILING, false);
