import { CustomeErrorHandler } from "./index.js";
import type { OrderStatus, RefundStatus } from "../types/domain.js";

/**
 * Fulfilment status only (SEC-05). Refunds live in `refundStatus` and payment in `paymentStatus`;
 * "refund_requested" and "refunded" are legacy fulfilment values that are no longer written.
 */
const fulfilmentTransitions: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "shipped", "delivered", "cancelled"],
  processing: ["shipped", "delivered"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
  refund_requested: [],
  refunded: [],
};

export const canTransitionOrder = (from: OrderStatus, to: OrderStatus) => from === to || (fulfilmentTransitions[from] ?? []).includes(to);

export const assertOrderTransition = (from: OrderStatus, to: OrderStatus): void => {
  if (!canTransitionOrder(from, to)) throw CustomeErrorHandler.conflict(`Invalid order transition from ${from} to ${to}`);
};

const refundTransitions: Record<RefundStatus, RefundStatus[]> = {
  none: ["requested"],
  requested: ["approved", "rejected", "processed"],
  approved: ["processed"],
  rejected: [],
  processed: [],
};

export const canTransitionRefund = (from: RefundStatus, to: RefundStatus) => (refundTransitions[from] ?? []).includes(to);

/** Statuses a customer may still cancel; a paid one opens a refund instead of keeping the money. */
export const CANCELLABLE_STATUSES: OrderStatus[] = ["pending", "confirmed"];

/** Refund requests are accepted for delivered orders only (earlier ones are cancelled instead). */
export const REFUNDABLE_STATUSES: OrderStatus[] = ["delivered"];
