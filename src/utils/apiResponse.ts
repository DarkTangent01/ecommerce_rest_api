import type { Response } from "express";

export interface SuccessPayload<T> {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ErrorPayload {
  success: false;
  message: string;
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
  };

  if (meta) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

export const errorResponse = (res: Response, message = "Internal server error", statusCode = 500, details: unknown = undefined) => {
  const payload: ErrorPayload = {
    success: false,
    message,
  };

  if (details) {
    payload.details = details;
  }

  return res.status(statusCode).json(payload);
};
