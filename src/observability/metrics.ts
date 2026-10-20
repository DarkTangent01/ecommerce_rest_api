import type { Request, Response } from "express";

interface LatencyStats {
  count: number;
  totalMs: number;
  maxMs: number;
}

export interface Alert {
  type: string;
  severity: string;
  payload: Record<string, unknown>;
  at: string;
}

const metrics = {
  requests: {} as Record<string, number>,
  errors: {} as Record<string, number>,
  latency: {} as Record<string, LatencyStats>,
  queueLag: {} as Record<string, number>,
  alerts: [] as Alert[],
};

const KNOWN_METHODS = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
/** Hard ceiling on distinct series, in case a future route template is itself unbounded. */
export const MAX_SERIES = 2000;
export const MAX_ALERTS = 500;

/**
 * Every label is drawn from a bounded set: the Express route template (never the raw path, which
 * any client can vary, SEC-04), "unmatched" for 404s, a known method and an HTTP status class.
 */
// req.baseUrl is already reset when "finish" fires, so the template is the route path alone.
export const keyFor = (req: Pick<Request, "method" | "route">, statusCode: number) => {
  const route = req.route as { path?: unknown } | undefined;
  const template = typeof route?.path === "string" ? route.path : "unmatched";
  const method = KNOWN_METHODS.has(req.method) ? req.method : "OTHER";
  const status = Number.isInteger(statusCode) && statusCode >= 100 && statusCode <= 599 ? statusCode : 0;
  return `${method} ${template} ${status}`;
};

const boundedKey = (key: string) =>
  key in metrics.requests || Object.keys(metrics.requests).length < MAX_SERIES ? key : "OTHER overflow 0";

export const recordRequest = (req: Request, res: Response, durationMs: number) => {
  const key = boundedKey(keyFor(req, res.statusCode));
  metrics.requests[key] = (metrics.requests[key] || 0) + 1;
  const stats = (metrics.latency[key] ??= { count: 0, totalMs: 0, maxMs: 0 });
  stats.count += 1;
  stats.totalMs += durationMs;
  stats.maxMs = Math.max(stats.maxMs, durationMs);
  if (res.statusCode >= 500) metrics.errors[key] = (metrics.errors[key] || 0) + 1;
};

export const recordQueueLag = (queueName: string, lagMs: number) => {
  metrics.queueLag[queueName] = lagMs;
};

export const emitAlert = (type: string, severity: string, payload: Record<string, unknown> = {}) => {
  metrics.alerts.push({ type, severity, payload, at: new Date().toISOString() });
  // Keep the most recent alerts only; this list used to grow for the life of the process.
  if (metrics.alerts.length > MAX_ALERTS) metrics.alerts.splice(0, metrics.alerts.length - MAX_ALERTS);
};

export const snapshotMetrics = () => metrics;

export const prometheusText = () => {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(metrics.requests)) {
    lines.push(`app_requests_total{route="${key.replace(/"/g, "")}"} ${value}`);
  }
  for (const [key, value] of Object.entries(metrics.errors)) {
    lines.push(`app_errors_total{route="${key.replace(/"/g, "")}"} ${value}`);
  }
  for (const [key, value] of Object.entries(metrics.latency)) {
    lines.push(`app_request_latency_ms_sum{route="${key.replace(/"/g, "")}"} ${value.totalMs}`);
    lines.push(`app_request_latency_ms_count{route="${key.replace(/"/g, "")}"} ${value.count}`);
  }
  return `${lines.join("\n")}\n`;
};
