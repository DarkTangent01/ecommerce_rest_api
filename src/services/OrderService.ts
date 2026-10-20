import type { ClientSession, FilterQuery, HydratedDocument } from "mongoose";
import { Cart, Coupon, CouponRedemption, InventoryReservation, Order, Product } from "../models/index.js";
import { CustomeErrorHandler } from "./index.js";
import { INVENTORY_RESERVATION_MINUTES, REFUND_WINDOW_DAYS } from "../config/index.js";
import { CANCELLABLE_STATUSES, REFUNDABLE_STATUSES } from "./orderStateMachine.js";
import { validateCouponForUser } from "./couponService.js";
import { queueNotification } from "./notificationService.js";
import { releaseOrderReservations } from "./inventoryService.js";
import { dispatchEvent, publishEvent, recordEvent } from "../infra/events/eventBus.js";
import { startOrderSaga } from "../infra/saga/sagaOrchestrator.js";
import { withDistributedLock } from "../infra/locks/distributedLock.js";
import { runInTransaction, sessionOption } from "../infrastructure/database/transaction.js";
import { emitAlert } from "../observability/metrics.js";
import auditLogger from "../utils/auditLogger.js";
import { buildPagination } from "../utils/pagination.js";
import { fromCents, toCents } from "../utils/money.js";
import { logEvent } from "../utils/requestContext.js";
import type { AuthedRequest } from "../types/http.js";
import type { Address, InventoryReservation as Reservation, Order as OrderShape, OrderItem } from "../types/domain.js";

export interface CheckoutInput {
  shippingAddress: Address;
  paymentProvider: string;
  paymentReference?: string;
  couponCode?: string;
}

export interface ReasonInput {
  reason: string;
}

type OrderDoc = HydratedDocument<OrderShape>;
type ReservationDoc = HydratedDocument<Reservation>;

class OrderService {
  /**
   * Reserves stock, applies the coupon and writes the order. With a session everything rolls
   * back together; without one (standalone MongoDB) each completed step registers an undo action
   * that runs if a later step fails, so stock and coupon usage are never leaked.
   */
  async executeCheckout(req: AuthedRequest, value: CheckoutInput, session: ClientSession | null = null) {
    const undo: Array<() => Promise<unknown>> = [];

    try {
      const cart = await Cart.findOne({ user: req.user._id, tenant: req.tenant }).session(session);
      if (!cart || cart.items.length === 0) {
        throw CustomeErrorHandler.badRequest("Cart is empty");
      }

      const orderItems: OrderItem[] = [];
      const reservations: ReservationDoc[] = [];
      let subtotalCents = 0;
      const reservationExpiresAt = new Date(Date.now() + INVENTORY_RESERVATION_MINUTES * 60 * 1000);

      for (const item of cart.items) {
        const product = await Product.findOneAndUpdate(
          { _id: item.product, tenant: req.tenant, isActive: true, deletedAt: null, stock: { $gte: item.quantity } },
          { $inc: { stock: -item.quantity } },
          { new: true, ...sessionOption(session) }
        );

        if (!product) {
          throw CustomeErrorHandler.badRequest("One or more products are unavailable or out of stock");
        }
        undo.push(() => Product.updateOne({ _id: product._id }, { $inc: { stock: item.quantity } }));

        const [reservation] = await InventoryReservation.create(
          [
            {
              user: req.user._id,
              tenant: req.tenant,
              product: product._id,
              quantity: item.quantity,
              expiresAt: reservationExpiresAt,
            },
          ],
          sessionOption(session)
        );
        // Stock is restored by the product undo above; the reservation just stops being active.
        undo.push(() => InventoryReservation.updateOne({ _id: reservation!._id }, { $set: { status: "released" } }));

        reservations.push(reservation!);
        const unitCents = toCents(product.price);
        subtotalCents += unitCents * item.quantity;
        orderItems.push({
          product: product._id,
          name: product.name,
          price: fromCents(unitCents),
          quantity: item.quantity,
        });
      }

      const { coupon, discountCents } = await validateCouponForUser(value.couponCode, req.user._id, subtotalCents, session, req.tenant);
      const subtotal = fromCents(subtotalCents);
      const discount = fromCents(discountCents);
      const total = fromCents(Math.max(subtotalCents - discountCents, 0));

      if (coupon) {
        // Atomic check-and-increment so concurrent checkouts cannot exceed usageLimit.
        const claimed = await Coupon.updateOne(
          { _id: coupon._id, usedCount: { $lt: coupon.usageLimit } },
          { $inc: { usedCount: 1 } },
          sessionOption(session)
        );
        if (claimed.modifiedCount !== 1) throw CustomeErrorHandler.badRequest("Coupon usage limit reached");
        undo.push(() => Coupon.updateOne({ _id: coupon._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } }));
      }

      const [created] = await Order.create(
        [
          {
            user: req.user._id,
            tenant: req.tenant,
            items: orderItems,
            subtotal,
            discountTotal: discount,
            total,
            coupon: coupon?._id,
            shippingAddress: value.shippingAddress,
            paymentProvider: value.paymentProvider,
            paymentReference: "",
            paymentStatus: "unpaid",
          },
        ],
        sessionOption(session)
      );
      const order = created!;
      undo.push(() => Order.deleteOne({ _id: order._id }));

      await InventoryReservation.updateMany(
        { _id: { $in: reservations.map((reservation) => reservation._id) } },
        { $set: { order: order._id } },
        sessionOption(session)
      );

      if (coupon) {
        await CouponRedemption.create([{ coupon: coupon._id, tenant: req.tenant, user: req.user._id, order: order._id }], sessionOption(session));
      }

      cart.items = [];
      await cart.save(sessionOption(session));
      return { order, total, reservations };
    } catch (err) {
      if (!session) await this.compensate(undo, req, err);
      throw err;
    }
  }

  private async compensate(undo: Array<() => Promise<unknown>>, req: AuthedRequest, cause: unknown) {
    for (const step of undo.reverse()) {
      try {
        await step();
      } catch (undoErr) {
        // Leave a loud trail: this is the one place stock could drift without a transaction.
        emitAlert("checkout.compensation_failed", "critical", { user: req.user._id, tenant: req.tenant, error: (undoErr as Error).message });
      }
    }
    logEvent("warn", "checkout.compensated", req, { reason: (cause as Error).message, steps: undo.length });
  }

  async afterCheckout(req: AuthedRequest, order: OrderDoc, total: number, reservations: ReservationDoc[], transactionFallback = false) {
    auditLogger("order.checkout", req, { order: order._id, total, transactionFallback });
    await queueNotification({ user: req.user._id, tenant: req.tenant, template: "order.created", payload: { orderId: order._id, total } });
    await startOrderSaga({ order, tenant: req.tenant, req });
    await publishEvent({
      type: "inventory.reserved",
      aggregateType: "order",
      aggregateId: order._id,
      tenant: req.tenant,
      payload: {
        orderId: order._id,
        reservations: reservations.map((reservation) => reservation._id),
        ...(transactionFallback && { transactionFallback }),
      },
      req,
    });
  }

  async checkout(req: AuthedRequest, value: CheckoutInput) {
    return withDistributedLock(`checkout:${req.tenant}:${String(req.user._id)}`, 30000, async () => {
      const outcome = await runInTransaction((session) => this.executeCheckout(req, value, session)).catch((err: unknown) => {
        emitAlert("checkout.failed", "high", { user: req.user._id, tenant: req.tenant, reason: (err as Error).message });
        throw err;
      });

      const { order, total, reservations } = outcome.result;
      // The order is committed at this point; follow-up side effects must not turn it into an error.
      try {
        await this.afterCheckout(req, order, total, reservations, !outcome.transactional);
      } catch (err) {
        emitAlert("checkout.side_effects_failed", "high", { order: order._id, reason: (err as Error).message });
        logEvent("error", "checkout.side_effects_failed", req, { order: order._id, error: (err as Error).message });
      }
      return order;
    });
  }

  async list(req: AuthedRequest) {
    const { page, limit, skip } = buildPagination(req.query);
    const filter: FilterQuery<OrderShape> = req.user.role === "admin" ? { tenant: req.tenant } : { user: req.user._id, tenant: req.tenant };
    const [orders, total] = await Promise.all([
      Order.find(filter).sort("-createdAt").skip(skip).limit(limit).lean(),
      Order.countDocuments(filter),
    ]);
    return { orders, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  private ownedOrderFilter(req: AuthedRequest): FilterQuery<OrderShape> {
    const filter: FilterQuery<OrderShape> = { _id: req.params.id, tenant: req.tenant };
    if (req.user.role !== "admin") filter.user = req.user._id;
    return filter;
  }

  async show(req: AuthedRequest) {
    const order = await Order.findOne(this.ownedOrderFilter(req));
    if (!order) throw CustomeErrorHandler.notFound("Order not found");
    return order;
  }

  /**
   * Cancels a pending or confirmed order and returns its stock exactly once. A captured payment is
   * never kept silently (SEC-05): cancelling a paid order also opens its refund, and the
   * refund.requested event commits in the same transaction as the cancellation (outbox).
   */
  async cancel(req: AuthedRequest, value: ReasonInput) {
    const now = new Date();
    const cancelledFields = { status: "cancelled", cancelledAt: now, cancellationReason: value.reason };
    const { result } = await runInTransaction(async (session) => {
      const base = { ...this.ownedOrderFilter(req), status: { $in: CANCELLABLE_STATUSES } };
      // Each update is a compare-and-set, so concurrent cancels, payments and expiry cannot all win.
      let cancelled = await Order.findOneAndUpdate(
        { ...base, paymentStatus: { $in: ["unpaid", "failed"] } },
        { $set: cancelledFields },
        { new: true, ...sessionOption(session) }
      );
      let refundOpened = false;
      if (!cancelled) {
        cancelled = await Order.findOneAndUpdate(
          { ...base, paymentStatus: { $in: ["paid", "authorized"] }, refundStatus: "none" },
          { $set: { ...cancelledFields, refundStatus: "requested", refundRequestedAt: now, refundReason: value.reason } },
          { new: true, ...sessionOption(session) }
        );
        refundOpened = Boolean(cancelled);
      }
      if (!cancelled) {
        const exists = await Order.exists(this.ownedOrderFilter(req)).session(session);
        if (!exists) throw CustomeErrorHandler.notFound("Order not found");
        throw CustomeErrorHandler.badRequest("Order cannot be cancelled in its current state");
      }
      await releaseOrderReservations(cancelled._id, session);

      const events = [
        await recordEvent(
          { type: "order.cancelled", aggregateType: "order", aggregateId: cancelled._id, tenant: req.tenant, payload: { reason: value.reason }, req },
          session
        ),
      ];
      if (refundOpened) {
        events.push(
          await recordEvent(
            {
              type: "refund.requested",
              aggregateType: "order",
              aggregateId: cancelled._id,
              tenant: req.tenant,
              payload: { reason: value.reason, cause: "cancelled_after_payment", amount: cancelled.total },
              req,
            },
            session
          )
        );
      }
      return { order: cancelled, events, refundOpened };
    });

    auditLogger("order.cancel", req, { order: result.order._id, reason: value.reason, refundOpened: result.refundOpened });
    await this.dispatchAll(result.events, req);
    return result.order;
  }

  /**
   * Opens a refund for a delivered, paid order within REFUND_WINDOW_DAYS, once (SEC-05). It used to
   * accept any paid order at any time and overwrite the fulfilment status with "refund_requested".
   * The fulfilment status is left alone; the refund is tracked in refundStatus.
   */
  async requestRefund(req: AuthedRequest, value: ReasonInput) {
    const now = new Date();
    const windowStart = new Date(now.getTime() - REFUND_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const { result } = await runInTransaction(async (session) => {
      const order = await Order.findOneAndUpdate(
        {
          ...this.ownedOrderFilter(req),
          paymentStatus: "paid",
          refundStatus: "none",
          status: { $in: REFUNDABLE_STATUSES },
          // Orders delivered before deliveredAt existed fall back to their last update.
          $or: [{ deliveredAt: { $gte: windowStart } }, { deliveredAt: { $exists: false }, updatedAt: { $gte: windowStart } }],
        },
        { $set: { refundStatus: "requested", refundRequestedAt: now, refundReason: value.reason } },
        { new: true, ...sessionOption(session) }
      );
      if (!order) throw await this.refundRejection(req, windowStart, session);
      const event = await recordEvent(
        {
          type: "refund.requested",
          aggregateType: "order",
          aggregateId: order._id,
          tenant: req.tenant,
          payload: { reason: value.reason, cause: "customer_request", amount: order.total },
          req,
        },
        session
      );
      return { order, event };
    });

    auditLogger("order.refund.request", req, { order: result.order._id, reason: value.reason });
    await this.dispatchAll([result.event], req);
    return result.order;
  }

  /** Explains why a refund request did not match, using the same ownership filter (no existence leak). */
  private async refundRejection(req: AuthedRequest, windowStart: Date, session: ClientSession | null) {
    const order = await Order.findOne(this.ownedOrderFilter(req)).session(session);
    if (!order) return CustomeErrorHandler.notFound("Order not found");
    if (order.refundStatus !== "none") return CustomeErrorHandler.conflict("A refund has already been requested for this order");
    if (order.paymentStatus !== "paid") return CustomeErrorHandler.badRequest("Only paid orders can be refunded");
    if (!REFUNDABLE_STATUSES.includes(order.status)) {
      return CustomeErrorHandler.badRequest("Refunds can be requested once the order is delivered; cancel it instead if it has not shipped");
    }
    if ((order.deliveredAt ?? order.updatedAt) < windowStart) {
      return CustomeErrorHandler.badRequest(`The refund window of ${REFUND_WINDOW_DAYS} days has passed`);
    }
    return CustomeErrorHandler.conflict("The order changed while processing the refund; retry");
  }

  /** Post-commit delivery: the events are durable already, so a queue failure is logged, not thrown. */
  private async dispatchAll(events: Parameters<typeof dispatchEvent>[0][], req: AuthedRequest) {
    for (const event of events) {
      try {
        await dispatchEvent(event, req);
      } catch (err) {
        logEvent("error", "domain.event.dispatch_failed", req, { event: event._id, type: event.type, error: (err as Error).message });
      }
    }
  }
}

export default OrderService;
