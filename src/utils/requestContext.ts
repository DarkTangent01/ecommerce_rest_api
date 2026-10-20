import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const headerValue = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/** Client-supplied ids must be short and plain; anything else is dropped (never echoed or logged). */
const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
export const safeClientId = (value: string | string[] | undefined): string | undefined => {
  const id = headerValue(value);
  return id && SAFE_ID.test(id) ? id : undefined;
};

/**
 * The request id is always generated here, so audit records and logs carry an id no client chose
 * (SEC-10). A valid client X-Correlation-Id (or, failing that, X-Request-Id) is kept only as the
 * correlation id for tracing across services.
 */
export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const requestId = crypto.randomUUID();
  const correlationId = safeClientId(req.headers["x-correlation-id"]) || safeClientId(req.headers["x-request-id"]) || requestId;
  req.requestId = requestId;
  req.correlationId = correlationId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Correlation-Id", correlationId);
  next();
};

export type LogLevel = "debug" | "info" | "warn" | "error";

export const logEvent = (level: LogLevel, message: string, req?: Partial<Request> | null, meta: Record<string, unknown> = {}) => {
  const entry = {
    at: new Date().toISOString(),
    level,
    message,
    requestId: req?.requestId || null,
    correlationId: req?.correlationId || null,
    tenant: req?.tenant || null,
    actor: req?.user?._id || null,
    role: req?.user?.role || null,
    method: req?.method || null,
    path: req?.originalUrl || null,
    ip: req?.ip || null,
    ...meta,
  };

  console.log(JSON.stringify(entry));
};
