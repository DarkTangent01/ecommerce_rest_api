// Response envelope and error shapes of the backend
// (mirrors src/utils/apiResponse.ts and src/shared/errors/AppError.ts in the API repo).

/** Error codes the backend can return in `error.code`. */
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'VALIDATION_FAILED'
  | 'LOCKED'
  | 'TOO_MANY_REQUESTS'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

/** One entry of `error.details` for VALIDATION_FAILED (field path joined with "."). */
export interface ValidationDetail {
  field: string;
  message: string;
}

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiSuccess<T, M = undefined> {
  success: true;
  message: string;
  data: T;
  error: null;
  meta?: M;
}

export interface ApiFailure {
  success: false;
  message: string;
  data: null;
  error: ApiErrorPayload;
  /** Deprecated duplicate of error.details kept by the backend for old clients. */
  details?: unknown;
}

export type ApiEnvelope<T, M = undefined> = ApiSuccess<T, M> | ApiFailure;

/** `meta` of offset-paginated lists (orders, reviews, coupons). */
export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/** `meta` of GET /products (adds cursor pagination). */
export interface ProductPageMeta extends PageMeta {
  nextCursor: string | null;
}

export interface Paged<T, M extends PageMeta = PageMeta> {
  items: T[];
  meta: M;
}
