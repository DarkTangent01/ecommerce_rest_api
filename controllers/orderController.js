import mongoose from "mongoose";
import { Cart, CouponRedemption, InventoryReservation, Order, Product } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { cancelOrderSchema, checkoutSchema, refundOrderSchema } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { buildPagination } from "../utils/pagination.js";
import auditLogger from "../utils/auditLogger.js";
import { INVENTORY_RESERVATION_MINUTES } from "../config/index.js";
import { validateCouponForUser } from "../services/couponService.js";
import { queueNotification } from "../services/notificationService.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { startOrderSaga } from "../infra/saga/sagaOrchestrator.js";
import { withDistributedLock } from "../infra/locks/distributedLock.js";
import { emitAlert } from "../observability/metrics.js";

const isTransactionUnsupported = (err) =>
  err?.code === 20 && /Transaction numbers are only allowed/.test(err.message || "");

const applySession = (query, session) => (session ? query.session(session) : query);

const executeCheckout = async (req, value, session = null) => {
  const cart = await applySession(Cart.findOne({ user: req.user._id, tenant: req.tenant }), session);
  if (!cart || cart.items.length === 0) {
    throw CustomeErrorHandler.badRequest("Cart is empty");
  }

  const orderItems = [];
  const reservations = [];
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

    reservations.push(reservation);
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

  const [order] = await Order.create(
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
};

const orderController = {
  async checkout(req, res, next) {
    return withDistributedLock(`checkout:${req.tenant}:${req.user._id}`, 30000, async () => {
      const { error, value } = checkoutSchema.validate(req.body);
      if (error) return next(error);

      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const { order, total, reservations } = await executeCheckout(req, value, session);
        await session.commitTransaction();
        auditLogger("order.checkout", req, { order: order._id, total });
        await queueNotification({ user: req.user._id, tenant: req.tenant, template: "order.created", payload: { orderId: order._id, total } });
        await startOrderSaga({ order, tenant: req.tenant, req });
        await publishEvent({
          type: "inventory.reserved",
          aggregateType: "order",
          aggregateId: order._id,
          tenant: req.tenant,
          payload: { orderId: order._id, reservations: reservations.map((reservation) => reservation._id) },
          req,
        });

        return successResponse(res, order, "Order created", 201);
      } catch (err) {
        await session.abortTransaction();
        if (isTransactionUnsupported(err)) {
          const { order, total, reservations } = await executeCheckout(req, value);
          auditLogger("order.checkout", req, { order: order._id, total, transactionFallback: true });
          await queueNotification({ user: req.user._id, tenant: req.tenant, template: "order.created", payload: { orderId: order._id, total } });
          await startOrderSaga({ order, tenant: req.tenant, req });
          await publishEvent({
            type: "inventory.reserved",
            aggregateType: "order",
            aggregateId: order._id,
            tenant: req.tenant,
            payload: { orderId: order._id, reservations: reservations.map((reservation) => reservation._id), transactionFallback: true },
            req,
          });
          return successResponse(res, order, "Order created", 201);
        }
        emitAlert("checkout.failed", "high", { user: req.user._id, tenant: req.tenant, reason: err.message });
        return next(err);
      } finally {
        session.endSession();
      }
    }).catch(next);
  },

  async index(req, res, next) {
    try {
      const { page, limit, skip } = buildPagination(req.query);
      const filter = req.user.role === "admin" ? { tenant: req.tenant } : { user: req.user._id, tenant: req.tenant };
      const [orders, total] = await Promise.all([
        Order.find(filter).sort("-createdAt").skip(skip).limit(limit).lean(),
        Order.countDocuments(filter),
      ]);

      return successResponse(res, orders, "Orders fetched", 200, {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      });
    } catch (err) {
      return next(err);
    }
  },

  async show(req, res, next) {
    try {
      const filter = { _id: req.params.id, tenant: req.tenant };
      if (req.user.role !== "admin") {
        filter.user = req.user._id;
      }

      const order = await Order.findOne(filter);
      if (!order) return next(CustomeErrorHandler.notFound("Order not found"));
      return successResponse(res, order, "Order fetched");
    } catch (err) {
      return next(err);
    }
  },

  async cancel(req, res, next) {
    const { error, value } = cancelOrderSchema.validate(req.body);
    if (error) return next(error);

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const filter = { _id: req.params.id, tenant: req.tenant };
      if (req.user.role !== "admin") filter.user = req.user._id;
      const order = await Order.findOne(filter).session(session);
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
      return successResponse(res, order, "Order cancelled");
    } catch (err) {
      await session.abortTransaction();
      return next(err);
    } finally {
      session.endSession();
    }
  },

  async requestRefund(req, res, next) {
    const { error, value } = refundOrderSchema.validate(req.body);
    if (error) return next(error);
    try {
      const filter = { _id: req.params.id, tenant: req.tenant };
      if (req.user.role !== "admin") filter.user = req.user._id;
      const order = await Order.findOne(filter);
      if (!order) return next(CustomeErrorHandler.notFound("Order not found"));
      if (order.paymentStatus !== "paid") return next(CustomeErrorHandler.badRequest("Only paid orders can be refunded"));
      order.status = "refund_requested";
      order.refundStatus = "requested";
      await order.save();
      auditLogger("order.refund.request", req, { order: order._id, reason: value.reason });
      await publishEvent({ type: "refund.requested", aggregateType: "order", aggregateId: order._id, tenant: req.tenant, payload: { reason: value.reason }, req });
      return successResponse(res, order, "Refund requested");
    } catch (err) {
      return next(err);
    }
  },
};

export default orderController;
