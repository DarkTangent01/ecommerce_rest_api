import crypto from "crypto";
import { InventoryReservation, Order, PaymentEvent, Product } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { applyPaymentTransition, assertPaymentTransition } from "../services/paymentStateMachine.js";
import { successResponse } from "../utils/apiResponse.js";
import { verifyWebhookSignature } from "../utils/webhook.js";
import auditLogger from "../utils/auditLogger.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { emitAlert } from "../observability/metrics.js";

const hashPayload = (payload) => crypto.createHash("sha256").update(payload).digest("hex");

const paymentController = {
  async webhook(req, res, next) {
    try {
      const signature = req.get("X-Webhook-Signature");
      const timestamp = req.get("X-Webhook-Timestamp");
      const provider = req.get("X-Payment-Provider") || "manual";
      const eventId = req.get("X-Webhook-Event-Id");
      const rawPayload = req.rawBody || JSON.stringify(req.body || {});

      if (!eventId) return next(CustomeErrorHandler.badRequest("Webhook event id is required"));
      verifyWebhookSignature(rawPayload, signature, timestamp);

      const existing = await PaymentEvent.findOne({ provider, eventId });
      if (existing) return successResponse(res, { replay: true }, "Webhook already processed");

      const { orderId, type, paymentReference } = req.body;
      const order = await Order.findById(orderId);
      if (!order) return next(CustomeErrorHandler.notFound("Order not found"));

      const targetState =
        type === "payment.succeeded" ? "paid" : type === "payment.failed" ? "failed" : type === "payment.refunded" ? "refunded" : null;
      if (!targetState) return next(CustomeErrorHandler.badRequest("Unsupported payment event"));
      assertPaymentTransition(order.paymentStatus, targetState);

      await PaymentEvent.create({
        provider,
        eventId,
        order: order._id,
        type,
        payloadHash: hashPayload(rawPayload),
      });

      applyPaymentTransition(order, targetState, type);
      order.paymentProvider = provider;
      order.paymentReference = paymentReference || order.paymentReference;
      await order.save();

      if (targetState === "paid") {
        await InventoryReservation.updateMany({ order: order._id, status: "reserved" }, { $set: { status: "committed" } });
        await publishEvent({ type: "payment.completed", aggregateType: "order", aggregateId: order._id, tenant: order.tenant, payload: { orderId: order._id, provider, eventId }, req });
      }
      if (targetState === "failed" || targetState === "refunded") {
        const reservations = await InventoryReservation.find({ order: order._id, status: { $in: ["reserved", "committed"] } });
        for (const reservation of reservations) {
          await Product.updateOne({ _id: reservation.product }, { $inc: { stock: reservation.quantity } });
          reservation.status = "released";
          await reservation.save();
        }
        await publishEvent({ type: targetState === "failed" ? "payment.failed" : "payment.refunded", aggregateType: "order", aggregateId: order._id, tenant: order.tenant, payload: { orderId: order._id, provider, eventId }, req });
        if (targetState === "failed") emitAlert("payment.failed", "high", { order: order._id, provider, eventId });
      }

      auditLogger("payment.webhook", req, { order: order._id, provider, eventId, type });

      return successResponse(res, order, "Webhook processed");
    } catch (err) {
      if (err.code === 11000) return successResponse(res, { replay: true }, "Webhook already processed");
      return next(err);
    }
  },
};

export default paymentController;
