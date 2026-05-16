export const startSpan = (name, req, attributes = {}) => ({
  name,
  traceId: req?.correlationId || req?.requestId,
  spanId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  attributes,
  startedAt: Date.now(),
  end(extra = {}) {
    return {
      name,
      traceId: this.traceId,
      spanId: this.spanId,
      durationMs: Date.now() - this.startedAt,
      ...extra,
    };
  },
});
