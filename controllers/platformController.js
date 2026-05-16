import { ApiKey, AuditLog, DomainEvent, SagaInstance, SecuritySignal } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { createScopedApiKey, createSignedUrl, verifySignedUrl } from "../services/securityService.js";
import { prometheusText, snapshotMetrics } from "../observability/metrics.js";
import { queueInfo } from "../utils/queue.js";
import { cache } from "../utils/cache.js";
import { serviceCatalog } from "../architecture/services.js";

const platformController = {
  readiness(req, res) {
    return successResponse(res, {
      status: "ready",
      cache: cache.backend,
      queue: queueInfo(),
      tenant: req.tenant,
    }, "Readiness check");
  },

  metrics(req, res) {
    if (req.accepts("text/plain")) {
      res.type("text/plain").send(prometheusText());
      return;
    }
    return successResponse(res, snapshotMetrics(), "Metrics fetched");
  },

  serviceCatalog(req, res) {
    return successResponse(res, serviceCatalog, "Service catalog fetched");
  },

  async events(req, res, next) {
    try {
      const events = await DomainEvent.find({ tenant: req.tenant }).sort("-createdAt").limit(100);
      return successResponse(res, events, "Domain events fetched");
    } catch (err) {
      return next(err);
    }
  },

  async sagas(req, res, next) {
    try {
      const sagas = await SagaInstance.find({ tenant: req.tenant }).sort("-createdAt").limit(100);
      return successResponse(res, sagas, "Sagas fetched");
    } catch (err) {
      return next(err);
    }
  },

  async securitySignals(req, res, next) {
    try {
      const signals = await SecuritySignal.find({ tenant: req.tenant }).sort("-createdAt").limit(100);
      return successResponse(res, signals, "Security signals fetched");
    } catch (err) {
      return next(err);
    }
  },

  async auditTrail(req, res, next) {
    try {
      const logs = await AuditLog.find({ tenant: req.tenant }).sort("-sequence").limit(100);
      return successResponse(res, logs, "Audit trail fetched");
    } catch (err) {
      return next(err);
    }
  },

  async createApiKey(req, res, next) {
    try {
      const { name, scopes = [], expiresAt } = req.body;
      const { apiKey, key } = await createScopedApiKey({
        name,
        tenant: req.tenant,
        scopes,
        expiresAt,
        createdBy: req.user._id,
      });
      return successResponse(res, { id: apiKey._id, key, scopes: apiKey.scopes }, "API key created", 201);
    } catch (err) {
      return next(err);
    }
  },

  async listApiKeys(req, res, next) {
    try {
      const keys = await ApiKey.find({ tenant: req.tenant }).select("-keyHash");
      return successResponse(res, keys, "API keys fetched");
    } catch (err) {
      return next(err);
    }
  },

  signedUrl(req, res) {
    const path = req.query.path || "/uploads";
    const subject = req.query.subject || req.user?._id || "";
    return successResponse(res, { url: createSignedUrl({ path, tenant: req.tenant, subject }) }, "Signed URL created");
  },

  validateSignedUrl(req, res) {
    const ok = verifySignedUrl({
      path: req.query.path,
      tenant: req.query.tenant,
      subject: req.query.subject,
      expires: req.query.expires,
      signature: req.query.signature,
    });
    return successResponse(res, { valid: ok }, "Signed URL validation complete");
  },

  securityHeaders(req, res) {
    return successResponse(res, {
      contentSecurityPolicy: Boolean(res.getHeader("Content-Security-Policy")),
      xFrameOptions: Boolean(res.getHeader("X-Frame-Options")),
      xContentTypeOptions: Boolean(res.getHeader("X-Content-Type-Options")),
      referrerPolicy: Boolean(res.getHeader("Referrer-Policy")),
      requestId: res.getHeader("X-Request-Id"),
    }, "Security headers inspected");
  },

  stream(req, res) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`event: connected\ndata: ${JSON.stringify({ requestId: req.requestId, tenant: req.tenant })}\n\n`);
  },
};

export default platformController;
