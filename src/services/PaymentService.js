import crypto from "crypto";
import { CustomeErrorHandler } from "./index.js";
import { applyPaymentTransition, assertPaymentTransition } from "./paymentStateMachine.js";
import PaymentRepository from "../repositories/PaymentRepository.js";
import { verifyWebhookSignature } from "../utils/webhook.js";
import auditLogger from "../utils/auditLogger.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { emitAlert } from "../observability/metrics.js";

class PaymentService {
  constructor(repository = new PaymentRepository()) {
    this.repository = repository;
  }

  hashPayload(payload) {
    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  targetStateForEvent(type) {
    const states = {
      "payment.succeeded": "paid",
      "payment.failed": "failed",
      "payment.refunded": "refunded",
    };
    return states[type] || null;
  }

  verifyWebhook({ rawPayload, signature, timestamp }) {
    verifyWebhookSignature(rawPayload, signature, timestamp);
  }

  async releaseReservations(orderId) {
    const reservations = await this.repository.findActiveReservations(orderId);
    for (const reservation of reservations) {
      await this.repository.restoreProductStock(reservation.product, reservation.quantity);
      reservation.status = "released";
      await this.repository.saveReservation(reservation);
    }
  }

  async processWebhook({ headers, body, rawPayload, req }) {
    const signature = headers.signature;
    const timestamp = headers.timestamp;
    const provider = headers.provider || "manual";
    const eventId = headers.eventId;

    if (!eventId) {
      throw CustomeErrorHandler.badRequest("Webhook event id is required");
    }

    this.verifyWebhook({ rawPayload, signature, timestamp });

    const existing = await this.repository.findEvent(provider, eventId);
    if (existing) {
      return { replay: true };
    }

    const { orderId, type, paymentReference } = body;
    const order = await this.repository.findOrderById(orderId);
    if (!order) {
      throw CustomeErrorHandler.notFound("Order not found");
    }

    const targetState = this.targetStateForEvent(type);
    if (!targetState) {
      throw CustomeErrorHandler.badRequest("Unsupported payment event");
    }

    assertPaymentTransition(order.paymentStatus, targetState);

    await this.repository.createEvent({
      provider,
      eventId,
      order: order._id,
      type,
      payloadHash: this.hashPayload(rawPayload),
    });

    applyPaymentTransition(order, targetState, type);
    order.paymentProvider = provider;
    order.paymentReference = paymentReference || order.paymentReference;
    await this.repository.saveOrder(order);

    if (targetState === "paid") {
      await this.repository.commitReservations(order._id);
      await publishEvent({
        type: "payment.completed",
        aggregateType: "order",
        aggregateId: order._id,
        tenant: order.tenant,
        payload: { orderId: order._id, provider, eventId },
        req,
      });
    }

    if (targetState === "failed" || targetState === "refunded") {
      await this.releaseReservations(order._id);
      await publishEvent({
        type: targetState === "failed" ? "payment.failed" : "payment.refunded",
        aggregateType: "order",
        aggregateId: order._id,
        tenant: order.tenant,
        payload: { orderId: order._id, provider, eventId },
        req,
      });
      if (targetState === "failed") {
        emitAlert("payment.failed", "high", { order: order._id, provider, eventId });
      }
    }

    auditLogger("payment.webhook", req, { order: order._id, provider, eventId, type });
    return { order };
  }
}

export default PaymentService;
