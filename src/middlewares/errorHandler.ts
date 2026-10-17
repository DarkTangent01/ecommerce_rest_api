import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { DEBUG_MODE } from "../config/index.js";
import { AppError } from "../shared/errors/AppError.js";
import { errorResponse } from "../utils/apiResponse.js";
import { RequestValidationError } from "../validators/common.js";
import { logEvent } from "../utils/requestContext.js";

interface HttpLikeError {
  type?: string;
  status?: number;
  statusCode?: number;
  expose?: boolean;
  code?: number | string;
  keyValue?: Record<string, unknown>;
}

/** Maps any thrown value onto an AppError with the right HTTP status. */
export const toAppError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;

  if (err instanceof RequestValidationError) {
    return new AppError(422, "Validation failed", { details: err.details });
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return new AppError(422, "Validation failed", { details });
  }

  if (err instanceof mongoose.Error.CastError) {
    return new AppError(400, `Invalid value for ${err.path}`);
  }

  if (err instanceof mongoose.Error.VersionError) {
    return new AppError(409, "The resource was modified concurrently, please retry");
  }

  const httpErr = (err ?? {}) as HttpLikeError;

  if (httpErr.code === 11000) {
    const fields = Object.keys(httpErr.keyValue ?? {});
    return new AppError(409, fields.length ? `Duplicate value for ${fields.join(", ")}` : "Duplicate value");
  }

  // body-parser / http-errors
  if (httpErr.type === "entity.parse.failed") return new AppError(400, "Malformed JSON body");
  if (httpErr.type === "entity.too.large") return new AppError(413, "Request body too large");
  const status = httpErr.status ?? httpErr.statusCode;
  if (httpErr.expose && typeof status === "number" && status >= 400 && status < 500) {
    return new AppError(status, (err as Error).message);
  }

  return new AppError(500, "Internal server error");
};

// Express identifies error middleware by its four-argument signature, so `_next` must stay.
const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const appError = toAppError(err);

  if (appError.status >= 500) {
    logEvent("error", "request.failed", req, {
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    });
  }

  let details = appError.details;
  if (DEBUG_MODE && appError.status >= 500) {
    details = { stack: (err as Error | undefined)?.stack };
  }

  return errorResponse(res, appError.message, appError.status, details, appError.code);
};

export default errorHandler;
