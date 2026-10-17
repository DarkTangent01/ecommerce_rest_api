import type { Response } from "express";
import type { ErrorCode } from "../shared/errors/AppError.js";

// Every response carries { success, data, error }. `message`, `details` and `meta` are kept
// alongside for clients written against the original envelope.

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export interface SuccessPayload<T> {
  success: true;
  message: string;
  data: T;
  error: null;
  meta?: Record<string, unknown>;
}

export interface ErrorPayload {
  success: false;
  message: string;
  data: null;
  error: ApiError;
  details?: unknown;
}

export const successResponse = <T>(
  res: Response,
  data: T = null as T,
  message = "Success",
  statusCode = 200,
  meta: Record<string, unknown> | undefined = undefined
) => {
  const payload: SuccessPayload<T> = {
    success: true,
    message,
    data,
    error: null,
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const errorResponse = (
  res: Response,
  message = "Internal server error",
  statusCode = 500,
  details: unknown = undefined,
  code: ErrorCode = "INTERNAL_ERROR"
) => {
  const payload: ErrorPayload = {
    success: false,
    message,
    data: null,
    error: { code, message },
  };

  if (details) {
    payload.details = details;
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
};
