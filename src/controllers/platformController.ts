import type { NextFunction, Request, Response } from "express";
import { ApiKey, AuditLog, DomainEvent, SagaInstance, SecuritySignal } from "../models/index.js";
import mongoose from "mongoose";
import { errorResponse, successResponse } from "../utils/apiResponse.js";
import { CustomeErrorHandler } from "../services/index.js";
import { createScopedApiKey, createSignedUrl, verifySignedUrl } from "../services/securityService.js";
import { prometheusText, snapshotMetrics } from "../observability/metrics.js";
import { queueInfo } from "../utils/queue.js";
import { cache } from "../utils/cache.js";
import { serviceCatalog } from "../architecture/services.js";
import { assertAuthed } from "../types/http.js";
import { apiKeySchema, validate } from "../validators/index.js";
import { SSE_HEARTBEAT_SECONDS, SSE_MAX_LIFETIME_SECONDS, SSE_MAX_STREAMS, SSE_MAX_STREAMS_PER_USER } from "../config/index.js";
import { StreamLimiter } from "../infra/sse/streamLimiter.js";

export const streamLimiter = new StreamLimiter({ perUser: SSE_MAX_STREAMS_PER_USER, global: SSE_MAX_STREAMS });

const queryString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

class PlatformController {
  constructor() {
    this.readiness = this.readiness.bind(this);
    this.metrics = this.metrics.bind(this);
    this.serviceCatalog = this.serviceCatalog.bind(this);
    this.events = this.events.bind(this);
    this.sagas = this.sagas.bind(this);
    this.securitySignals = this.securitySignals.bind(this);
    this.auditTrail = this.auditTrail.bind(this);
    this.createApiKey = this.createApiKey.bind(this);
    this.listApiKeys = this.listApiKeys.bind(this);
    this.signedUrl = this.signedUrl.bind(this);
    this.validateSignedUrl = this.validateSignedUrl.bind(this);
    this.securityHeaders = this.securityHeaders.bind(this);
    this.stream = this.stream.bind(this);
  }

  readiness(req: Request, res: Response) {
    // Readiness must reflect the database: load balancers route traffic based on it.
    const dbState = mongoose.connection.readyState;
    if (dbState !== mongoose.ConnectionStates.connected) {
      return errorResponse(res, "Service not ready", 503, { database: mongoose.ConnectionStates[dbState] }, "SERVICE_UNAVAILABLE");
    }
    return successResponse(
      res,
      {
        status: "ready",
        database: "connected",
        cache: cache.backend,
        queue: queueInfo(),
        tenant: req.tenant,
      },
      "Readiness check"
    );
  }

  metrics(req: Request, res: Response) {
    if (req.accepts("text/plain")) {
      res.type("text/plain").send(prometheusText());
      return;
    }
    return successResponse(res, snapshotMetrics(), "Metrics fetched");
  }

  serviceCatalog(_req: Request, res: Response) {
    return successResponse(res, serviceCatalog, "Service catalog fetched");
  }

  async events(req: Request, res: Response, next: NextFunction) {
    try {
      const events = await DomainEvent.find({ tenant: req.tenant }).sort("-createdAt").limit(100);
      return successResponse(res, events, "Domain events fetched");
    } catch (err) {
      return next(err);
    }
  }

  async sagas(req: Request, res: Response, next: NextFunction) {
    try {
      const sagas = await SagaInstance.find({ tenant: req.tenant }).sort("-createdAt").limit(100);
      return successResponse(res, sagas, "Sagas fetched");
    } catch (err) {
      return next(err);
    }
  }

  async securitySignals(req: Request, res: Response, next: NextFunction) {
    try {
      const signals = await SecuritySignal.find({ tenant: req.tenant }).sort("-createdAt").limit(100);
      return successResponse(res, signals, "Security signals fetched");
    } catch (err) {
      return next(err);
    }
  }

  async auditTrail(req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await AuditLog.find({ tenant: req.tenant }).sort("-sequence").limit(100);
      return successResponse(res, logs, "Audit trail fetched");
    } catch (err) {
      return next(err);
    }
  }

  async createApiKey(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(apiKeySchema, req.body);
    if (error) return next(error);
    try {
      assertAuthed(req);
      const { name, scopes, expiresAt } = value;
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
  }

  async listApiKeys(req: Request, res: Response, next: NextFunction) {
    try {
      const keys = await ApiKey.find({ tenant: req.tenant }).select("-keyHash");
      return successResponse(res, keys, "API keys fetched");
    } catch (err) {
      return next(err);
    }
  }

  signedUrl(req: Request, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const path = queryString(req.query.path) || "/uploads";
      // Only upload paths can be signed, and only an admin may sign on behalf of someone else.
      if (!/^\/uploads(\/[\w.-]+)*$/.test(path) || path.includes("..")) {
        throw CustomeErrorHandler.badRequest("Only /uploads paths can be signed");
      }
      const ownSubject = String(req.user._id);
      const requested = queryString(req.query.subject);
      if (requested && requested !== ownSubject && req.user.role !== "admin") {
        throw CustomeErrorHandler.forbidden("Cannot sign URLs for another subject");
      }
      const subject = requested || ownSubject;
      return successResponse(res, { url: createSignedUrl({ path, tenant: req.tenant, subject }) }, "Signed URL created");
    } catch (err) {
      return next(err);
    }
  }

  validateSignedUrl(req: Request, res: Response) {
    const ok = verifySignedUrl({
      path: queryString(req.query.path),
      tenant: queryString(req.query.tenant),
      subject: queryString(req.query.subject),
      expires: queryString(req.query.expires),
      signature: queryString(req.query.signature),
    });
    return successResponse(res, { valid: ok }, "Signed URL validation complete");
  }

  securityHeaders(_req: Request, res: Response) {
    return successResponse(
      res,
      {
        contentSecurityPolicy: Boolean(res.getHeader("Content-Security-Policy")),
        xFrameOptions: Boolean(res.getHeader("X-Frame-Options")),
        xContentTypeOptions: Boolean(res.getHeader("X-Content-Type-Options")),
        referrerPolicy: Boolean(res.getHeader("Referrer-Policy")),
        requestId: res.getHeader("X-Request-Id"),
      },
      "Security headers inspected"
    );
  }

  /**
   * Server-sent events. Each user may hold SSE_MAX_STREAMS_PER_USER streams and the process
   * SSE_MAX_STREAMS in total; every stream ends after SSE_MAX_LIFETIME_SECONDS (clients reconnect).
   * Unlimited streams used to let one user hold any number of sockets and timers (SEC-06).
   */
  stream(req: Request, res: Response, next: NextFunction) {
    assertAuthed(req);
    const release = streamLimiter.acquire(String(req.user._id));
    if (!release) {
      res.setHeader("Retry-After", "30");
      return next(CustomeErrorHandler.toManyRequest("Too many open event streams"));
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.write(`retry: 5000\nevent: connected\ndata: ${JSON.stringify({ requestId: req.requestId, tenant: req.tenant })}\n\n`);

    const finish = () => {
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      release();
      if (!res.writableEnded) res.end();
    };
    // Keep proxies from timing the stream out; end it after its maximum lifetime.
    const heartbeat = setInterval(() => res.write(": keep-alive\n\n"), SSE_HEARTBEAT_SECONDS * 1000);
    const lifetime = setTimeout(() => {
      res.write("event: expired\ndata: {}\n\n");
      finish();
    }, SSE_MAX_LIFETIME_SECONDS * 1000);
    heartbeat.unref();
    lifetime.unref();
    req.on("close", finish);
    res.on("close", finish);
    res.on("error", finish);
  }
}

export default new PlatformController();
