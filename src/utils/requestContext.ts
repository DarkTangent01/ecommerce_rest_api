import crypto from "crypto";
import type { NextFunction, Request, Response } from "express";

const headerValue = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

export const requestContext = (req: Request, res: Response, next: NextFunction) => {
  const requestId = headerValue(req.headers["x-request-id"]) || crypto.randomUUID();
  const correlationId = headerValue(req.headers["x-correlation-id"]) || requestId;
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
