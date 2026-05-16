import { CustomeErrorHandler } from "../services/index.js";

const allowlist = new Set(["category"]);

const preventParameterPollution = (req, res, next) => {
  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value) && !allowlist.has(key)) {
      return next(CustomeErrorHandler.badRequest(`Duplicate query parameter is not allowed: ${key}`));
    }
  }

  return next();
};

export default preventParameterPollution;
