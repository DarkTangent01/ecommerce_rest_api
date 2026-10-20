import crypto from "crypto";
import { WEBHOOK_SECRET } from "../config/index.js";
import { CustomeErrorHandler } from "../services/index.js";

export const signPayload = (payload: string, timestamp: string | number, secret = WEBHOOK_SECRET): string =>
  crypto.createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");

export const verifyWebhookSignature = (
  rawPayload: string | undefined,
  signature: string | undefined,
  timestamp: string | undefined,
  toleranceSeconds = 300
): void => {
  if (!rawPayload || !signature || !timestamp) {
    throw CustomeErrorHandler.unAuthorized("Missing webhook signature");
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSeconds) {
    throw CustomeErrorHandler.unAuthorized("Stale webhook");
  }

  const expected = signPayload(rawPayload, timestamp);
  const provided = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) {
    throw CustomeErrorHandler.unAuthorized("Invalid webhook signature");
  }
};
