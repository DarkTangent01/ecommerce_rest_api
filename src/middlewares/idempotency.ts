import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { IDEMPOTENCY_TTL_HOURS } from "../config/index.js";
import { IdempotencyKey } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { logEvent } from "../utils/requestContext.js";

/** A "processing" key older than this is treated as abandoned (e.g. the process crashed mid-request). */
const STALE_PROCESSING_MS = 2 * 60 * 1000;

const hashBody = (body: unknown) =>
  crypto
    .createHash("sha256")
    .update(JSON.stringify(body || {}))
    .digest("hex");

const idempotency = async (req: Request, res: Response, next: NextFunction) => {
  const key = req.get("Idempotency-Key");
  if (!key || key.length < 16 || key.length > 120) {
    return next(CustomeErrorHandler.badRequest("A valid Idempotency-Key header is required"));
  }
  if (!req.user) return next(CustomeErrorHandler.unAuthorized());
  const userId = req.user._id;

  const requestHash = hashBody(req.body);
  const route = (req.route as { path?: string } | undefined)?.path || req.path;

  try {
    const existing = await IdempotencyKey.findOne({ key, user: userId, route });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return next(CustomeErrorHandler.badRequest("Idempotency key reused with a different payload"));
      }
      if (existing.status === "completed") {
        return res.status(existing.statusCode || 200).json(existing.response);
      }
      if (Date.now() - existing.createdAt.getTime() < STALE_PROCESSING_MS) {
        return next(CustomeErrorHandler.toManyRequest("Request with this idempotency key is still processing"));
      }
      await IdempotencyKey.deleteOne({ _id: existing._id, status: "processing" });
    }

    const record = await IdempotencyKey.create({
      key,
      user: userId,
      route,
      requestHash,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
    });
    req.idempotencyRecord = record;

    // Persist the outcome before the response leaves, so an immediate retry replays it. A 5xx
    // releases the key so the client can retry. Persistence failures are logged, never thrown:
    // the original handler's response is still delivered.
    const originalJson = res.json.bind(res);
    res.json = (payload: unknown) => {
      const statusCode = res.statusCode;
      const persist =
        statusCode >= 500
          ? record.deleteOne()
          : Object.assign(record, { response: payload, statusCode, status: "completed" as const }).save();
      persist
        .catch((err: unknown) => {
          logEvent("error", "idempotency.persist_failed", req, { key, error: (err as Error).message });
        })
        .finally(() => {
          originalJson(payload);
        });
      return res;
    };

    return next();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return next(CustomeErrorHandler.toManyRequest("Duplicate idempotency request"));
    }
    return next(err);
  }
};

export default idempotency;
