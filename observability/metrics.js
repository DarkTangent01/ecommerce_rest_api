const metrics = {
  requests: {},
  errors: {},
  latency: {},
  queueLag: {},
  alerts: [],
};

const keyFor = (req, statusCode) => `${req.method} ${req.route?.path || req.path} ${statusCode}`;

export const recordRequest = (req, res, durationMs) => {
  const key = keyFor(req, res.statusCode);
  metrics.requests[key] = (metrics.requests[key] || 0) + 1;
  metrics.latency[key] = metrics.latency[key] || { count: 0, totalMs: 0, maxMs: 0 };
  metrics.latency[key].count += 1;
  metrics.latency[key].totalMs += durationMs;
  metrics.latency[key].maxMs = Math.max(metrics.latency[key].maxMs, durationMs);
  if (res.statusCode >= 500) metrics.errors[key] = (metrics.errors[key] || 0) + 1;
};

export const recordQueueLag = (queueName, lagMs) => {
  metrics.queueLag[queueName] = lagMs;
};

export const emitAlert = (type, severity, payload = {}) => {
  metrics.alerts.push({ type, severity, payload, at: new Date().toISOString() });
};

export const snapshotMetrics = () => metrics;

export const prometheusText = () => {
  const lines = [];
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
