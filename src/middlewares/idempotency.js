import crypto from "crypto";
import { IDEMPOTENCY_TTL_HOURS } from "../config/index.js";
import { IdempotencyKey } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";

const hashBody = (body) => crypto.createHash("sha256").update(JSON.stringify(body || {})).digest("hex");

const idempotency = async (req, res, next) => {
  const key = req.get("Idempotency-Key");
  if (!key || key.length < 16 || key.length > 120) {
    return next(CustomeErrorHandler.badRequest("A valid Idempotency-Key header is required"));
  }

  const requestHash = hashBody(req.body);
  const route = req.route?.path || req.path;

  try {
    const existing = await IdempotencyKey.findOne({ key, user: req.user._id, route });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        return next(CustomeErrorHandler.badRequest("Idempotency key reused with a different payload"));
      }
      if (existing.status === "completed") {
        return res.status(existing.statusCode || 200).json(existing.response);
      }
      return next(CustomeErrorHandler.toManyRequest("Request with this idempotency key is still processing"));
    }

    req.idempotencyRecord = await IdempotencyKey.create({
      key,
      user: req.user._id,
      route,
      requestHash,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
    });

    const originalJson = res.json.bind(res);
    res.json = async (payload) => {
      if (req.idempotencyRecord && res.statusCode < 500) {
        req.idempotencyRecord.response = payload;
        req.idempotencyRecord.statusCode = res.statusCode;
        req.idempotencyRecord.status = "completed";
        await req.idempotencyRecord.save();
      }
      return originalJson(payload);
    };

    return next();
  } catch (err) {
    if (err.code === 11000) {
      return next(CustomeErrorHandler.toManyRequest("Duplicate idempotency request"));
    }
    return next(err);
  }
};

export default idempotency;
