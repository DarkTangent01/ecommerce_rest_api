/**
 * Concurrent SSE stream accounting (SEC-06). In-process only: with several API instances each one
 * enforces its own caps, so the effective global limit is per instance. Move the counters to Redis
 * before relying on them across instances.
 */
export interface StreamLimits {
  perUser: number;
  global: number;
}

export class StreamLimiter {
  private readonly perUser = new Map<string, number>();
  private total = 0;

  constructor(private readonly limits: StreamLimits) {}

  /** Reserves a slot, or returns null when the user's or the global cap is reached. */
  acquire(userId: string): (() => void) | null {
    const current = this.perUser.get(userId) ?? 0;
    if (current >= this.limits.perUser || this.total >= this.limits.global) return null;
    this.perUser.set(userId, current + 1);
    this.total += 1;

    let released = false;
    // Idempotent: close, error and the lifetime timer may all fire for one stream.
    return () => {
      if (released) return;
      released = true;
      this.total -= 1;
      const remaining = (this.perUser.get(userId) ?? 1) - 1;
      if (remaining > 0) this.perUser.set(userId, remaining);
      else this.perUser.delete(userId);
    };
  }

  stats() {
    return { total: this.total, users: this.perUser.size };
  }

  countFor(userId: string) {
    return this.perUser.get(userId) ?? 0;
  }
}
