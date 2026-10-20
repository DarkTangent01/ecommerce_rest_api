import crypto from "crypto";
import type { Request } from "express";
import type { Types } from "mongoose";
import { ApiKey, SecuritySignal, UserSession } from "../models/index.js";
import { SIGNED_URL_SECRET, SIGNED_URL_TTL_SECONDS } from "../config/index.js";
import type { SignalSeverity } from "../models/securitySignal.js";

type Id = Types.ObjectId | string;

export const recordSecuritySignal = async ({
  type,
  severity = "info",
  user,
  tenant,
  ip,
  metadata = {},
}: {
  type: string;
  severity?: SignalSeverity;
  user?: Id;
  tenant?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}) => SecuritySignal.create({ type, severity, user, tenant, ip, metadata });

export const deviceIdFor = (req: Pick<Request, "get" | "ip">): string =>
  req.get("X-Device-Id") || crypto.createHash("sha256").update(`${req.get("user-agent") || "unknown"}:${req.ip}`).digest("hex");

export const trackSession = async ({ user, refreshToken, req }: { user: { _id: Id }; refreshToken?: Id; req: Request }) => {
  const deviceId = deviceIdFor(req);
  const recentFailedLogins = await SecuritySignal.countDocuments({
    type: "auth.login_failed",
    ip: req.ip,
    createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
  });
  const riskScore = recentFailedLogins >= 5 ? 80 : 10;

  return UserSession.findOneAndUpdate(
    { user: user._id, deviceId },
    {
      ...(refreshToken && { refreshToken }),
      userAgent: req.get("user-agent"),
      ip: req.ip,
      riskScore,
      stepUpRequired: riskScore >= 70,
      lastSeenAt: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

/** Points a session at its current refresh token (set at sign-in, moved on every rotation). */
export const linkSessionToRefreshToken = (sessionId: Id, refreshToken: Id) =>
  UserSession.updateOne({ _id: sessionId }, { $set: { refreshToken, lastSeenAt: new Date() } });

export const createApiKeyValue = () => `ek_${crypto.randomBytes(32).toString("hex")}`;
export const hashApiKeyValue = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

export const createScopedApiKey = async ({
  name,
  tenant,
  scopes,
  createdBy,
  expiresAt,
}: {
  name: string;
  tenant: string;
  scopes: string[];
  createdBy: Id;
  expiresAt?: Date;
}) => {
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

export const createSignedUrl = ({
  path,
  tenant,
  subject,
  ttlSeconds = SIGNED_URL_TTL_SECONDS,
}: {
  path: string;
  tenant: string;
  subject?: string;
  ttlSeconds?: number;
}) => {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${path}.${tenant}.${subject || ""}.${expires}`;
  const signature = crypto.createHmac("sha256", SIGNED_URL_SECRET).update(payload).digest("hex");
  return `${path}?tenant=${encodeURIComponent(tenant)}&subject=${encodeURIComponent(subject || "")}&expires=${expires}&signature=${signature}`;
};

type MaybeString = string | null | undefined;

export const verifySignedUrl = ({
  path,
  tenant,
  subject,
  expires,
  signature,
}: {
  path: MaybeString;
  tenant: MaybeString;
  subject: MaybeString;
  expires: MaybeString;
  signature: MaybeString;
}): boolean => {
  if (!expires || Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const payload = `${path}.${tenant}.${subject || ""}.${expires}`;
  const expected = crypto.createHmac("sha256", SIGNED_URL_SECRET).update(payload).digest("hex");
  const provided = Buffer.from(signature || "", "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return provided.length === expectedBuffer.length && crypto.timingSafeEqual(provided, expectedBuffer);
};
