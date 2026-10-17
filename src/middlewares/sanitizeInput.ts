import type { NextFunction, Request, Response } from "express";

const SKIP_KEYS = new Set(["password", "repeat_password", "access_token", "refresh_token", "token", "authorization", "signature"]);

const sanitizeString = (value: string) => value.replace(/[<>]/g, "");

const sanitizeObject = (value: unknown, parentKey = ""): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item, parentKey));
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, childValue] of Object.entries(record)) {
      record[key] = sanitizeObject(childValue, key.toLowerCase());
    }
    return record;
  }

  if (typeof value === "string" && !SKIP_KEYS.has(parentKey)) {
    return sanitizeString(value);
  }

  return value;
};

const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};

export default sanitizeInput;
