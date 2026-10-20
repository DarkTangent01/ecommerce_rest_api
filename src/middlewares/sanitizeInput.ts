import type { NextFunction, Request, Response } from "express";

/**
 * Light input hygiene, applied to body, query and params.
 *
 * This used to strip every "<" and ">" from all strings, which corrupted legitimate text (product
 * descriptions, reviews, "a < b") while not being a real XSS defence (I-5). XSS is prevented where
 * data is rendered: the API only returns JSON (with nosniff), and the Angular client escapes by
 * default. What remains here is lossless for real text:
 * - C0 control characters other than tab, newline and carriage return are removed (NUL bytes and
 *   friends confuse logs, terminals and downstream parsers);
 * - prototype-related keys are dropped so no handler can merge them into an object's prototype.
 * NoSQL operator keys are rejected separately by sanitizeNoSql, and every route validates with Zod.
 */
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(sanitizeValue);

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (FORBIDDEN_KEYS.has(key)) {
        delete record[key];
        continue;
      }
      record[key] = sanitizeValue(record[key]);
    }
    return record;
  }

  if (typeof value === "string") return value.replace(CONTROL_CHARS, "");
  return value;
};

const sanitizeInput = (req: Request, _res: Response, next: NextFunction) => {
  if (req.body) sanitizeValue(req.body);
  if (req.query) sanitizeValue(req.query);
  if (req.params) sanitizeValue(req.params);
  next();
};

export default sanitizeInput;
