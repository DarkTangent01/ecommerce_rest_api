import { HttpErrorResponse } from '@angular/common/http';
import type { ApiErrorCode, ApiFailure, ValidationDetail } from '../models';

const FALLBACK_MESSAGES: Record<number, string> = {
  0: 'Cannot reach the server. Check your connection and try again.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'This changed in the meantime. Please refresh and try again.',
  413: 'That file or request is too large.',
  423: 'Another request is still being processed. Please wait a moment.',
  429: 'Too many attempts. Please wait a few minutes and try again.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
};

const isApiFailure = (body: unknown): body is ApiFailure =>
  typeof body === 'object' && body !== null && (body as { success?: unknown }).success === false && 'error' in body;

const isValidationDetails = (value: unknown): value is ValidationDetail[] =>
  Array.isArray(value) && value.every((d) => typeof d === 'object' && d !== null && 'field' in d && 'message' in d);

/** Every failed API call surfaces as this, regardless of whether the backend or the network failed. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | 'NETWORK_ERROR' | 'UNKNOWN';
  readonly fieldErrors: ValidationDetail[];

  constructor(status: number, code: ApiError['code'], message: string, fieldErrors: ValidationDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }

  static from(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (!(error instanceof HttpErrorResponse)) {
      return new ApiError(0, 'UNKNOWN', 'Something went wrong. Please try again.');
    }
    if (error.status === 0) {
      return new ApiError(0, 'NETWORK_ERROR', FALLBACK_MESSAGES[0]!);
    }
    if (isApiFailure(error.error)) {
      const { code, message, details } = error.error.error;
      // 5xx messages are generic server-side already; never show anything more detailed.
      const shown = error.status >= 500 ? FALLBACK_MESSAGES[503]! : message;
      return new ApiError(error.status, code, shown, isValidationDetails(details) ? details : []);
    }
    return new ApiError(error.status, 'UNKNOWN', FALLBACK_MESSAGES[error.status] ?? 'Something went wrong. Please try again.');
  }

  /** Message for one form field, if the server rejected it. */
  fieldMessage(field: string): string | undefined {
    return this.fieldErrors.find((detail) => detail.field === field)?.message;
  }
}
