import type { ClientSession, Types } from "mongoose";
import { InventoryReservation, Order, Product } from "../models/index.js";
import { sessionOption } from "../infrastructure/database/transaction.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { logEvent } from "../utils/requestContext.js";
import type { ReservationStatus } from "../types/domain.js";

type Id = Types.ObjectId | string;

/**
 * Moves a reservation out of an active state and returns its stock exactly once. The status
 * guard makes concurrent releases (cancel vs. payment failure vs. expiry) safe without a lock.
 */
export const releaseReservation = async (
  reservationId: Id,
  to: Extract<ReservationStatus, "released" | "expired">,
  session: ClientSession | null = null,
  from: ReservationStatus[] = ["reserved", "committed"]
): Promise<boolean> => {
  const reservation = await InventoryReservation.findOneAndUpdate(
    { _id: reservationId, status: { $in: from } },
    { $set: { status: to } },
    { new: true, ...sessionOption(session) }
  );
  if (!reservation) return false;
  await Product.updateOne({ _id: reservation.product }, { $inc: { stock: reservation.quantity } }, sessionOption(session));
  return true;
};

export const releaseOrderReservations = async (
  orderId: Id,
  session: ClientSession | null = null,
  to: Extract<ReservationStatus, "released" | "expired"> = "released"
): Promise<number> => {
  const reservations = await InventoryReservation.find({ order: orderId, status: { $in: ["reserved", "committed"] } })
    .select("_id")
    .session(session);
  let released = 0;
  for (const reservation of reservations) {
    if (await releaseReservation(reservation._id, to, session)) released += 1;
  }
  return released;
};

export const EXPIRED_ORDER_REASON = "Payment window expired";

/**
 * Handles reservations whose payment window has passed. The order is cancelled first, with an
 * atomic pending+unpaid guard, and only then is its stock returned. A payment that wins the race
 * leaves the order paid, in which case the reservation is committed instead of released.
 */
export const releaseExpiredReservations = async (now = new Date(), batchSize = 100) => {
  const expired = await InventoryReservation.find({ status: "reserved", expiresAt: { $lte: now } })
    .sort({ expiresAt: 1 })
    .limit(batchSize)
    .select("_id order tenant");

  let released = 0;
  let cancelled = 0;
  const handledOrders = new Set<string>();

  for (const reservation of expired) {
    if (!reservation.order) {
      // Orphaned by a checkout that failed before the order was written.
      if (await releaseReservation(reservation._id, "expired", null, ["reserved"])) released += 1;
      continue;
    }

    const orderKey = String(reservation.order);
    if (handledOrders.has(orderKey)) continue;
    handledOrders.add(orderKey);

    const cancelledOrder = await Order.findOneAndUpdate(
      { _id: reservation.order, status: "pending", paymentStatus: "unpaid" },
      { $set: { status: "cancelled", cancelledAt: now, cancellationReason: EXPIRED_ORDER_REASON } },
      { new: true }
    );

    if (cancelledOrder) {
      cancelled += 1;
      released += await releaseOrderReservations(cancelledOrder._id, null, "expired");
      // The cancellation is already durable; a failed notification must not abort the rest of the batch.
      try {
        await publishEvent({
          type: "order.cancelled",
          aggregateType: "order",
          aggregateId: cancelledOrder._id,
          tenant: cancelledOrder.tenant,
          payload: { reason: EXPIRED_ORDER_REASON },
        });
      } catch (err) {
        logEvent("error", "inventory.expiry_event_failed", null, { order: cancelledOrder._id, error: (err as Error).message });
      }
      continue;
    }

    const order = await Order.findById(reservation.order).select("paymentStatus status");
    if (!order) {
      released += await releaseOrderReservations(reservation.order, null, "expired");
    } else if (order.paymentStatus === "paid" || order.paymentStatus === "authorized") {
      await InventoryReservation.updateMany({ order: order._id, status: "reserved" }, { $set: { status: "committed" } });
    }
    // Any other state (e.g. already cancelled) released its reservations when it got there.
  }

  return { released, cancelled };
};

/** Periodically runs {@link releaseExpiredReservations}. Returns a stop function. */
export const startReservationSweeper = (intervalSeconds: number) => {
  let running = false;
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    releaseExpiredReservations()
      .then((result) => {
        if (result.released || result.cancelled) logEvent("info", "inventory.reservations_expired", null, result);
      })
      .catch((err: unknown) => logEvent("error", "inventory.sweep_failed", null, { error: (err as Error).message }))
      .finally(() => {
        running = false;
      });
  }, intervalSeconds * 1000);
  timer.unref();
  return () => clearInterval(timer);
};
