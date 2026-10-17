import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../services/index.js";

const allowlist = new Set(["category"]);

const preventParameterPollution = (req: Request, _res: Response, next: NextFunction) => {
  for (const [key, value] of Object.entries(req.query || {})) {
    if (Array.isArray(value) && !allowlist.has(key)) {
      return next(CustomeErrorHandler.badRequest(`Duplicate query parameter is not allowed: ${key}`));
    }
  }

  return next();
};

export default preventParameterPollution;
