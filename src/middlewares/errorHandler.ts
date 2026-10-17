import type { NextFunction, Request, Response } from "express";
import { DEBUG_MODE } from "../config/index.js";
import CustomeErrorHandler from "../services/CustomeErrorHandler.js";
import { errorResponse } from "../utils/apiResponse.js";
import { RequestValidationError } from "../validators/common.js";

// Express identifies error middleware by its four-argument signature, so `_next` must stay.
const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let message = "Internal server error";
  let details: unknown;

  if (err instanceof RequestValidationError) {
    statusCode = 422;
    message = "Validation failed";
    details = err.details;
  } else if (err instanceof CustomeErrorHandler) {
    statusCode = err.status;
    message = err.message;
  } else {
    console.error(err);
  }

  // Validate the status code
  if (statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  if (DEBUG_MODE && statusCode >= 500) {
    details = { stack: (err as Error | undefined)?.stack };
  }

  return errorResponse(res, message, statusCode, details);
};

export default errorHandler;
