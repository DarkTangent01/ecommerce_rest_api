import { recordRequest } from "../observability/metrics.js";

const metricsMiddleware = (req, res, next) => {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    recordRequest(req, res, durationMs);
  });
  next();
};

export default metricsMiddleware;
