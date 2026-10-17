export type ErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "VALIDATION_FAILED"
  | "LOCKED"
  | "TOO_MANY_REQUESTS"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE";

const defaultCodes: Record<number, ErrorCode> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  422: "VALIDATION_FAILED",
  423: "LOCKED",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_ERROR",
  503: "SERVICE_UNAVAILABLE",
};

export const codeForStatus = (status: number): ErrorCode => defaultCodes[status] ?? (status >= 500 ? "INTERNAL_ERROR" : "BAD_REQUEST");

/**
 * An error that is safe to show to API clients. Anything else reaching the error handler is
 * treated as an unexpected 500 and its message is not exposed.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, message?: string, options: { code?: ErrorCode; details?: unknown } = {}) {
    super();
    this.name = "AppError";
    this.status = status;
    this.code = options.code ?? codeForStatus(status);
    this.details = options.details;
    // Messages may echo user input, so strip characters that could be rendered as markup.
    this.message = String(message || "Error").replace(/[<>{}]/g, "");
  }
}
