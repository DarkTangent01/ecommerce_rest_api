import { HttpErrorResponse } from '@angular/common/http';
import { ApiError } from './api-error';
import { failure } from '../../../testing/test-helpers';

const httpError = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('ApiError.from', () => {
  it('keeps the backend code, message and field errors', () => {
    const err = ApiError.from(httpError(422, failure('VALIDATION_FAILED', 'Validation failed', [{ field: 'email', message: 'must be a valid email' }])));
    expect(err).toMatchObject({ status: 422, code: 'VALIDATION_FAILED', message: 'Validation failed' });
    expect(err.fieldMessage('email')).toBe('must be a valid email');
    expect(err.fieldMessage('name')).toBeUndefined();
  });

  it('never shows server error details for 5xx', () => {
    const err = ApiError.from(httpError(500, failure('INTERNAL_ERROR', 'Internal server error', { stack: 'Error: at db.js:1' })));
    expect(err.message).not.toContain('stack');
    expect(err.message).toMatch(/temporarily unavailable/);
  });

  it('explains network failures', () => {
    expect(ApiError.from(httpError(0, new ProgressEvent('error')))).toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('falls back to a friendly message for non-envelope bodies', () => {
    expect(ApiError.from(httpError(429, 'Too Many Requests')).message).toMatch(/Too many attempts/);
  });
});
