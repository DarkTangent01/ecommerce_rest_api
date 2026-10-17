import { AppError, type ErrorCode } from "../shared/errors/AppError.js";

/** Factory helpers for {@link AppError}. Kept under its original name for existing call sites. */
class CustomeErrorHandler extends AppError {
  constructor(status: number, msg?: string, options: { code?: ErrorCode; details?: unknown } = {}) {
    super(status, msg, options);
  }

  static alreadyExist(message?: string) {
    return new CustomeErrorHandler(409, message);
  }

  static wrongCredentials(message = "Username or Password is wrong!") {
    return new CustomeErrorHandler(401, message);
  }

  static unAuthorized(message = "unAuthorized") {
    return new CustomeErrorHandler(401, message);
  }

  static forbidden(message = "Forbidden") {
    return new CustomeErrorHandler(403, message);
  }

  static notFound(message = "404 Not Found") {
    return new CustomeErrorHandler(404, message);
  }

  static conflict(message = "Conflict") {
    return new CustomeErrorHandler(409, message);
  }

  static serverError(message = "Internal server error") {
    return new CustomeErrorHandler(500, message);
  }

  static serviceUnavailable(message = "Service unavailable") {
    return new CustomeErrorHandler(503, message);
  }

  static toManyRequest(message = "To many request, Try again later.") {
    return new CustomeErrorHandler(429, message);
  }

  static badRequest(message = "Bad request") {
    return new CustomeErrorHandler(400, message);
  }
}

export default CustomeErrorHandler;
