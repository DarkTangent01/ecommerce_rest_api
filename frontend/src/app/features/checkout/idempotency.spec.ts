import { ApiError } from '../../core/http/api-error';
import { CheckoutAttempt } from './idempotency';

describe('CheckoutAttempt', () => {
  const body = { shippingAddress: { line1: '1 Road' } };

  it('reuses the key when retrying the same body after a retryable failure', () => {
    const attempt = new CheckoutAttempt();
    const first = attempt.keyFor(body);
    attempt.failed(new ApiError(0, 'NETWORK_ERROR', 'offline'));
    expect(attempt.keyFor(body)).toBe(first);
    attempt.failed(new ApiError(503, 'SERVICE_UNAVAILABLE', 'down'));
    expect(attempt.keyFor(body)).toBe(first);
  });

  it('uses a fresh key after a client error (the backend replays stored 4xx outcomes)', () => {
    const attempt = new CheckoutAttempt();
    const first = attempt.keyFor(body);
    attempt.failed(new ApiError(400, 'BAD_REQUEST', 'Invalid coupon'));
    expect(attempt.keyFor(body)).not.toBe(first);
  });

  it('uses a fresh key when the body changes', () => {
    const attempt = new CheckoutAttempt();
    const first = attempt.keyFor(body);
    expect(attempt.keyFor({ ...body, couponCode: 'SAVE' })).not.toBe(first);
  });

  it('keys satisfy the backend length rule (16-120)', () => {
    const key = new CheckoutAttempt().keyFor(body);
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key.length).toBeLessThanOrEqual(120);
  });
});
