import crypto from "crypto";

export const requestContext = (req, res, next) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  const correlationId = req.headers["x-correlation-id"] || requestId;
  req.requestId = requestId;
  req.correlationId = correlationId;
  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Correlation-Id", correlationId);
  next();
};

export const logEvent = (level, message, req, meta = {}) => {
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
