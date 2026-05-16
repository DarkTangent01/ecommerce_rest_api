import crypto from "crypto";
import { ApiKey, SecuritySignal, UserSession } from "../models/index.js";
import { SIGNED_URL_SECRET, SIGNED_URL_TTL_SECONDS } from "../config/index.js";

export const recordSecuritySignal = async ({ type, severity = "info", user, tenant, ip, metadata = {} }) =>
  SecuritySignal.create({ type, severity, user, tenant, ip, metadata });

export const trackSession = async ({ user, refreshToken, req }) => {
  const deviceId = req.get("X-Device-Id") || crypto.createHash("sha256").update(`${req.get("user-agent") || "unknown"}:${req.ip}`).digest("hex");
  const recentFailedLogins = await SecuritySignal.countDocuments({
    type: "auth.login_failed",
    ip: req.ip,
    createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
  });
  const riskScore = recentFailedLogins >= 5 ? 80 : 10;

  return UserSession.findOneAndUpdate(
    { user: user._id, deviceId },
    {
      refreshToken,
      userAgent: req.get("user-agent"),
      ip: req.ip,
      riskScore,
      stepUpRequired: riskScore >= 70,
      lastSeenAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const createApiKeyValue = () => `ek_${crypto.randomBytes(32).toString("hex")}`;
export const hashApiKeyValue = (value) => crypto.createHash("sha256").update(value).digest("hex");

export const createScopedApiKey = async ({ name, tenant, scopes, createdBy, expiresAt }) => {
  const key = createApiKeyValue();
  const apiKey = await ApiKey.create({
    name,
    tenant,
    scopes,
    createdBy,
    expiresAt,
    keyHash: hashApiKeyValue(key),
  });
  return { apiKey, key };
};

export const createSignedUrl = ({ path, tenant, subject, ttlSeconds = SIGNED_URL_TTL_SECONDS }) => {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${path}.${tenant}.${subject || ""}.${expires}`;
  const signature = crypto.createHmac("sha256", SIGNED_URL_SECRET).update(payload).digest("hex");
  return `${path}?tenant=${encodeURIComponent(tenant)}&subject=${encodeURIComponent(subject || "")}&expires=${expires}&signature=${signature}`;
};

export const verifySignedUrl = ({ path, tenant, subject, expires, signature }) => {
  if (!expires || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const payload = `${path}.${tenant}.${subject || ""}.${expires}`;
  const expected = crypto.createHmac("sha256", SIGNED_URL_SECRET).update(payload).digest("hex");
  const provided = Buffer.from(signature || "", "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
};
