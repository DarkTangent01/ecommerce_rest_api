import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";
import { IDEMPOTENCY_TTL_HOURS } from "../config/index.js";
import { IdempotencyKey } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";

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
      return next(CustomeErrorHandler.toManyRequest("Request with this idempotency key is still processing"));
    }

    const record = await IdempotencyKey.create({
      key,
      user: userId,
      route,
      requestHash,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
    });
    req.idempotencyRecord = record;

    const originalJson = res.json.bind(res);
    // TODO: async override of a sync API; its rejection is unhandled (audit H3, fixed in Phase 4).
    res.json = (async (payload: unknown) => {
      if (req.idempotencyRecord && res.statusCode < 500) {
        req.idempotencyRecord.response = payload;
        req.idempotencyRecord.statusCode = res.statusCode;
        req.idempotencyRecord.status = "completed";
        await req.idempotencyRecord.save();
      }
      return originalJson(payload);
    }) as unknown as Response["json"];

    return next();
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return next(CustomeErrorHandler.toManyRequest("Duplicate idempotency request"));
    }
    return next(err);
  }
};

export default idempotency;
