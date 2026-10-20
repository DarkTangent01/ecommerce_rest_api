import type { ClientSession, Types } from "mongoose";
import { InventoryReservation, Order, PaymentEvent } from "../models/index.js";
import { sessionOption } from "../infrastructure/database/transaction.js";
import type { Order as OrderShape, Payment, PaymentStatus, RefundStatus } from "../types/domain.js";

type Id = Types.ObjectId | string;

export interface OrderTransition {
  orderId: Id;
  /** Expected current state; the update only applies if the order still matches it. */
  from: Pick<OrderShape, "paymentStatus" | "status">;
  to: { paymentStatus: PaymentStatus; status: OrderShape["status"]; refundStatus?: RefundStatus };
  reason: string;
  provider: string;
  paymentReference?: string;
}

class PaymentRepository {
  /** An event already processed under this id, or with exactly the same signed content (SEC-11). */
  findEvent(provider: string, eventId: string, signedDigest?: string) {
    return PaymentEvent.findOne({ $or: [{ provider, eventId }, ...(signedDigest ? [{ signedDigest }] : [])] });
  }

  createEvent(data: Pick<Payment, "provider" | "eventId" | "type" | "payloadHash" | "signedDigest"> & { order: Id }, session: ClientSession | null = null) {
    return PaymentEvent.create([data], sessionOption(session));
  }

  findOrderById(orderId: Id) {
    return Order.findById(orderId);
  }

  /**
   * Compare-and-set on the order's payment state. Returns null if the order changed since it was
   * read (concurrent webhook, cancellation or reservation expiry), so only one writer wins.
   */
  transitionOrder({ orderId, from, to, reason, provider, paymentReference }: OrderTransition, session: ClientSession | null = null) {
    return Order.findOneAndUpdate(
      { _id: orderId, paymentStatus: from.paymentStatus, status: from.status },
      {
        $set: {
          paymentStatus: to.paymentStatus,
          status: to.status,
          ...(to.refundStatus && { refundStatus: to.refundStatus }),
          paymentProvider: provider,
          ...(paymentReference && { paymentReference }),
        },
        $push: { paymentStateHistory: { from: from.paymentStatus, to: to.paymentStatus, reason, at: new Date() } },
      },
      { new: true, ...sessionOption(session) }
    );
  }

  commitReservations(orderId: Id, session: ClientSession | null = null) {
    return InventoryReservation.updateMany({ order: orderId, status: "reserved" }, { $set: { status: "committed" } }, sessionOption(session));
  }
}

export default PaymentRepository;
