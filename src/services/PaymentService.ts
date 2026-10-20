import crypto from "crypto";
import type { Request } from "express";
import { z } from "zod";
import { CustomeErrorHandler } from "./index.js";
import { assertPaymentTransition } from "./paymentStateMachine.js";
import { releaseOrderReservations } from "./inventoryService.js";
import { recordSecuritySignal } from "./securityService.js";
import PaymentRepository from "../repositories/PaymentRepository.js";
import { runInTransaction } from "../infrastructure/database/transaction.js";
import { verifyWebhookSignature } from "../utils/webhook.js";
import auditLogger from "../utils/auditLogger.js";
import { logEvent } from "../utils/requestContext.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { emitAlert } from "../observability/metrics.js";
import { objectIdString, validate } from "../validators/common.js";
import { WEBHOOK_PROVIDERS } from "../config/index.js";
import { Tenant } from "../models/index.js";
import type { Order, PaymentStatus } from "../types/domain.js";

export interface WebhookHeaders {
  signature?: string;
  timestamp?: string;
  provider?: string;
  eventId?: string;
}

export const webhookBodySchema = z.object({
  orderId: objectIdString(),
  type: z.enum(["payment.succeeded", "payment.failed", "payment.refunded"]),
  paymentReference: z.string().trim().max(160).optional(),
});

export type WebhookBody = z.input<typeof webhookBodySchema>;

const TARGET_STATE: Record<z.infer<typeof webhookBodySchema>["type"], PaymentStatus> = {
  "payment.succeeded": "paid",
  "payment.failed": "failed",
  "payment.refunded": "refunded",
};

const nextOrderStatus = (order: Pick<Order, "status">, to: PaymentStatus): Order["status"] =>
  to === "paid" && order.status === "pending" ? "confirmed" : order.status;

const trustedProviders = () =>
  new Set(
    WEBHOOK_PROVIDERS.split(",")
      .map((name) => name.trim())
      .filter(Boolean)
  );

class PaymentService {
  repository: PaymentRepository;

  constructor(repository = new PaymentRepository()) {
    this.repository = repository;
  }

  hashPayload(payload: string) {
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  targetStateForEvent(type: string | undefined): PaymentStatus | null {
    return (type && TARGET_STATE[type as keyof typeof TARGET_STATE]) || null;
  }

  verifyWebhook({ rawPayload, signature, timestamp }: { rawPayload: string; signature?: string; timestamp?: string }) {
    verifyWebhookSignature(rawPayload, signature, timestamp);
  }

  async processWebhook({ headers, body, rawPayload, req }: { headers: WebhookHeaders; body: unknown; rawPayload: string; req: Partial<Request> }) {
    const provider = (headers.provider || "manual").trim().toLowerCase();
    const eventId = headers.eventId;

    if (!eventId) {
      throw CustomeErrorHandler.badRequest("Webhook event id is required");
    }

    this.verifyWebhook({ rawPayload, signature: headers.signature, timestamp: headers.timestamp });
    if (!trustedProviders().has(provider)) {
      throw CustomeErrorHandler.unAuthorized("Unknown payment provider");
    }

    // The event id and provider headers are not signed; the digest of the signed content is the
    // dedupe key that a replay under a new id cannot change (SEC-11).
    const signedDigest = this.hashPayload(`${headers.timestamp}.${rawPayload}`);
    const existing = await this.repository.findEvent(provider, eventId, signedDigest);
    if (existing) {
      return { replay: true as const };
    }

    const { error, value } = validate(webhookBodySchema, body);
    if (error) throw error;
    const { orderId, type, paymentReference } = value;

    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw CustomeErrorHandler.notFound("Order not found");
    }
    // The provider must be the one the order's tenant pays through, so one tenant's provider
    // cannot settle another tenant's orders.
    const tenant = await Tenant.findOne({ key: order.tenant }).select("config.paymentProvider").lean();
    if ((tenant?.config?.paymentProvider || "manual").toLowerCase() !== provider) {
      await recordSecuritySignal({ type: "payment.provider_mismatch", severity: "high", tenant: order.tenant, metadata: { order: order._id, provider, eventId } });
      throw CustomeErrorHandler.notFound("Order not found");
    }

    const targetState = TARGET_STATE[type];

    // A cancelled order has already returned its stock; confirming it would oversell. The money
    // has to go back to the customer instead, so make it loud.
    if (order.status === "cancelled" && (targetState === "paid" || targetState === "authorized")) {
      await recordSecuritySignal({ type: "payment.on_cancelled_order", severity: "high", tenant: order.tenant, metadata: { order: order._id, provider, eventId } });
      emitAlert("payment.on_cancelled_order", "high", { order: order._id, provider, eventId });
      throw CustomeErrorHandler.conflict("Order is cancelled; payment must be refunded");
    }

    assertPaymentTransition(order.paymentStatus, targetState);

    // The order transition, reservation changes and the event record commit together. Without
    // transactions the compare-and-set on the order still lets only one webhook win, and the event
    // is written last, so a failure before it lets the provider's retry re-run the whole step.
    const { result: updated } = await runInTransaction(async (session) => {
      let current = order;
      if (order.paymentStatus !== targetState) {
        const transitioned = await this.repository.transitionOrder(
          {
            orderId: order._id,
            from: { paymentStatus: order.paymentStatus, status: order.status },
            // A provider refund completes any open refund request (or records one done provider-side).
            to: { paymentStatus: targetState, status: nextOrderStatus(order, targetState), ...(targetState === "refunded" && { refundStatus: "processed" as const }) },
            reason: type,
            provider,
            paymentReference,
          },
          session
        );
        if (!transitioned) throw CustomeErrorHandler.conflict("Order changed while processing the payment; retry");
        current = transitioned;
      }

      if (targetState === "paid") {
        await this.repository.commitReservations(order._id, session);
      } else {
        await releaseOrderReservations(order._id, session);
      }

      await this.repository.createEvent({ provider, eventId, order: order._id, type, payloadHash: this.hashPayload(rawPayload), signedDigest }, session);
      return current;
    });

    await this.afterWebhook(updated, targetState, { provider, eventId, type }, req);
    return { order: updated };
  }

  /** Notifications after the payment state is durable; failures are logged, not surfaced. */
  private async afterWebhook(
    order: Pick<Order, "_id" | "tenant">,
    targetState: PaymentStatus,
    meta: { provider: string; eventId: string; type: string },
    req: Partial<Request>
  ) {
    try {
      const eventType = targetState === "paid" ? "payment.completed" : targetState === "failed" ? "payment.failed" : "payment.refunded";
      await publishEvent({
        type: eventType,
        aggregateType: "order",
        aggregateId: order._id,
        tenant: order.tenant,
        payload: { orderId: order._id, provider: meta.provider, eventId: meta.eventId },
        req,
      });
      if (targetState === "failed") {
        emitAlert("payment.failed", "high", { order: order._id, provider: meta.provider, eventId: meta.eventId });
      }
      auditLogger("payment.webhook", req, { order: order._id, ...meta });
    } catch (err) {
      logEvent("error", "payment.side_effects_failed", req, { order: order._id, error: (err as Error).message });
    }
  }
}

export default PaymentService;
