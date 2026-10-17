import mongoose, { type ClientSession, type FilterQuery, type HydratedDocument } from "mongoose";
import { Cart, CouponRedemption, InventoryReservation, Order, Product } from "../models/index.js";
import { CustomeErrorHandler } from "./index.js";
import { INVENTORY_RESERVATION_MINUTES } from "../config/index.js";
import { validateCouponForUser } from "./couponService.js";
import { queueNotification } from "./notificationService.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { startOrderSaga } from "../infra/saga/sagaOrchestrator.js";
import { withDistributedLock } from "../infra/locks/distributedLock.js";
import { emitAlert } from "../observability/metrics.js";
import auditLogger from "../utils/auditLogger.js";
import { buildPagination } from "../utils/pagination.js";
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

const isTransactionUnsupported = (err: unknown) => {
  const e = err as { code?: number; message?: string } | null;
  return e?.code === 20 && /Transaction numbers are only allowed/.test(e.message || "");
};

const applySession = <Q extends { session(session: ClientSession): Q }>(query: Q, session: ClientSession | null): Q =>
  session ? query.session(session) : query;

class OrderService {
  async executeCheckout(req: AuthedRequest, value: CheckoutInput, session: ClientSession | null = null) {
    const cart = await applySession(Cart.findOne({ user: req.user._id, tenant: req.tenant }), session);
    if (!cart || cart.items.length === 0) {
      throw CustomeErrorHandler.badRequest("Cart is empty");
    }

    const orderItems: OrderItem[] = [];
    const reservations: ReservationDoc[] = [];
    let subtotal = 0;
    const reservationExpiresAt = new Date(Date.now() + INVENTORY_RESERVATION_MINUTES * 60 * 1000);

    for (const item of cart.items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.product, tenant: req.tenant, isActive: true, deletedAt: null, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true, ...(session && { session }) }
      );

      if (!product) {
        throw CustomeErrorHandler.badRequest("One or more products are unavailable or out of stock");
      }

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
        session ? { session } : undefined
      );

      reservations.push(reservation!);
      subtotal += product.price * item.quantity;
      orderItems.push({
        product: product._id,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
      });
    }

    const { coupon, discount } = await validateCouponForUser(value.couponCode, req.user._id, subtotal, session, req.tenant);
    const total = Math.max(subtotal - discount, 0);

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
      session ? { session } : undefined
    );
    const order = created!;

    await InventoryReservation.updateMany(
      { _id: { $in: reservations.map((reservation) => reservation._id) } },
      { $set: { order: order._id } },
      session ? { session } : undefined
    );

    if (coupon) {
      await CouponRedemption.create([{ coupon: coupon._id, tenant: req.tenant, user: req.user._id, order: order._id }], session ? { session } : undefined);
      coupon.usedCount += 1;
      await coupon.save(session ? { session } : undefined);
    }

    cart.items = [];
    await cart.save(session ? { session } : undefined);
    return { order, total, reservations };
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
      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        const result = await this.executeCheckout(req, value, session);
        await session.commitTransaction();
        await this.afterCheckout(req, result.order, result.total, result.reservations);
        return result.order;
      } catch (err) {
        await session.abortTransaction();
        if (isTransactionUnsupported(err)) {
          const result = await this.executeCheckout(req, value);
          await this.afterCheckout(req, result.order, result.total, result.reservations, true);
          return result.order;
        }
        emitAlert("checkout.failed", "high", { user: req.user._id, tenant: req.tenant, reason: (err as Error).message });
        throw err;
      } finally {
        await session.endSession();
      }
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

  async cancel(req: AuthedRequest, value: ReasonInput) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const order = await Order.findOne(this.ownedOrderFilter(req)).session(session);
      if (!order) throw CustomeErrorHandler.notFound("Order not found");
      if (!["pending", "confirmed"].includes(order.status)) {
        throw CustomeErrorHandler.badRequest("Order cannot be cancelled in its current state");
      }

      order.status = "cancelled";
      order.cancelledAt = new Date();
      order.cancellationReason = value.reason;
      await order.save({ session });

      const reservations = await InventoryReservation.find({ order: order._id, status: { $in: ["reserved", "committed"] } }).session(session);
      for (const reservation of reservations) {
        await Product.updateOne({ _id: reservation.product }, { $inc: { stock: reservation.quantity } }, { session });
        reservation.status = "released";
        await reservation.save({ session });
      }

      await session.commitTransaction();
      auditLogger("order.cancel", req, { order: order._id, reason: value.reason });
      await publishEvent({ type: "order.cancelled", aggregateType: "order", aggregateId: order._id, tenant: req.tenant, payload: { reason: value.reason }, req });
      return order;
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }
  }

  async requestRefund(req: AuthedRequest, value: ReasonInput) {
    const order = await Order.findOne(this.ownedOrderFilter(req));
    if (!order) throw CustomeErrorHandler.notFound("Order not found");
    if (order.paymentStatus !== "paid") throw CustomeErrorHandler.badRequest("Only paid orders can be refunded");
    order.status = "refund_requested";
    order.refundStatus = "requested";
    await order.save();
    auditLogger("order.refund.request", req, { order: order._id, reason: value.reason });
    await publishEvent({ type: "refund.requested", aggregateType: "order", aggregateId: order._id, tenant: req.tenant, payload: { reason: value.reason }, req });
    return order;
  }
}

export default OrderService;
