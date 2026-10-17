import crypto from "crypto";
import { ApiKey } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";

export const hashApiKey = (key) => crypto.createHash("sha256").update(key).digest("hex");

const apiKeyAuth = (...requiredScopes) => async (req, res, next) => {
  const rawKey = req.get("X-API-Key");
  if (!rawKey) return next(CustomeErrorHandler.unAuthorized("API key required"));

  try {
    const apiKey = await ApiKey.findOne({ keyHash: hashApiKey(rawKey), status: "active" });
    if (!apiKey || (apiKey.expiresAt && apiKey.expiresAt < new Date())) {
      return next(CustomeErrorHandler.unAuthorized("Invalid API key"));
    }
    const allowed = requiredScopes.every((scope) => apiKey.scopes.includes(scope));
    if (!allowed) return next(CustomeErrorHandler.forbidden("API key scope denied"));

    apiKey.lastUsedAt = new Date();
    await apiKey.save();
    req.apiKey = apiKey;
    req.tenant = apiKey.tenant;
    return next();
  } catch (err) {
    return next(err);
  }
};

export default apiKeyAuth;
