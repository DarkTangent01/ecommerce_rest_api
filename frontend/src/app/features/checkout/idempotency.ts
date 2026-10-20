import type { ApiError } from '../../core/http/api-error';

const newKey = () => `chk-${crypto.randomUUID()}`;

/**
 * Idempotency-Key lifecycle for POST /orders/checkout.
 *
 * The backend stores the outcome of each key for 24h and replays it: a retry with the same key
 * and body returns the original order instead of creating a second one, and a 5xx releases the
 * key. It also stores 4xx outcomes, so after a client error (empty cart, bad coupon, stock) the
 * next attempt needs a fresh key or it would replay the old error. A different body with the same
 * key is rejected, so a changed form also gets a fresh key.
 */
export class CheckoutAttempt {
  private key = newKey();
  private body: string | null = null;

  keyFor(body: unknown): string {
    const serialized = JSON.stringify(body);
    if (this.body !== null && this.body !== serialized) this.key = newKey();
    this.body = serialized;
    return this.key;
  }

  /** Decide whether the next submit may reuse the key (only for retryable failures). */
  failed(error: ApiError): void {
    const retryable = error.status === 0 || error.status === 423 || error.status === 429 || error.status >= 500;
    if (!retryable) this.reset();
  }

  reset(): void {
    this.key = newKey();
    this.body = null;
  }
}
