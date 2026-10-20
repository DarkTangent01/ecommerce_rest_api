import type { Request } from "express";

export const startSpan = (name: string, req?: Partial<Request> | null, attributes: Record<string, unknown> = {}) => ({
  name,
  traceId: req?.correlationId || req?.requestId,
  spanId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  attributes,
  startedAt: Date.now(),
  end(extra: Record<string, unknown> = {}) {
    return {
      name,
      traceId: this.traceId,
      spanId: this.spanId,
      durationMs: Date.now() - this.startedAt,
      ...extra,
    };
  },
});
