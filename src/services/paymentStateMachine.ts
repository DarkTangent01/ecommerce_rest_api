import { CustomeErrorHandler } from "./index.js";
import type { Order, PaymentStatus } from "../types/domain.js";

const allowedTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  unpaid: ["authorized", "paid", "failed"],
  authorized: ["paid", "failed", "refunded"],
  paid: ["refunded"],
  failed: [],
  refunded: [],
};

export const assertPaymentTransition = (from: PaymentStatus, to: PaymentStatus): void => {
  if (from === to) return;
  if (!allowedTransitions[from]?.includes(to)) {
    throw CustomeErrorHandler.badRequest(`Invalid payment transition from ${from} to ${to}`);
  }
};

export const applyPaymentTransition = (
  order: Pick<Order, "paymentStatus" | "status"> & { paymentStateHistory: { push(entry: { from: string; to: string; reason?: string }): unknown } },
  to: PaymentStatus,
  reason = ""
): void => {
  assertPaymentTransition(order.paymentStatus, to);
  order.paymentStateHistory.push({
    from: order.paymentStatus,
    to,
    reason,
  });
  order.paymentStatus = to;
  if (to === "paid" && order.status === "pending") {
    order.status = "confirmed";
  }
};
