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

const keyFor = (req: Request, statusCode: number) => {
  const route = req.route as { path?: string } | undefined;
  return `${req.method} ${route?.path || req.path} ${statusCode}`;
};

export const recordRequest = (req: Request, res: Response, durationMs: number) => {
  const key = keyFor(req, res.statusCode);
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
