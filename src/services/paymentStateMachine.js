import { CustomeErrorHandler } from "./index.js";

const allowedTransitions = {
  unpaid: ["authorized", "paid", "failed"],
  authorized: ["paid", "failed", "refunded"],
  paid: ["refunded"],
  failed: [],
  refunded: [],
};

export const assertPaymentTransition = (from, to) => {
  if (from === to) return;
  if (!allowedTransitions[from]?.includes(to)) {
    throw CustomeErrorHandler.badRequest(`Invalid payment transition from ${from} to ${to}`);
  }
};

export const applyPaymentTransition = (order, to, reason = "") => {
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
