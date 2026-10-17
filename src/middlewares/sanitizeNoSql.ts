import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../services/index.js";

const hasUnsafeKey = (value: unknown): boolean => {
  if (Array.isArray(value)) {
    return value.some(hasUnsafeKey);
  }

  if (value && typeof value === "object") {
    return Object.entries(value).some(([key, child]) => key.startsWith("$") || key.includes(".") || hasUnsafeKey(child));
  }

  return false;
};

const sanitizeNoSql = (req: Request, _res: Response, next: NextFunction) => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query) || hasUnsafeKey(req.params)) {
    return next(CustomeErrorHandler.badRequest("Unsafe query payload"));
  }

  return next();
};

export default sanitizeNoSql;
