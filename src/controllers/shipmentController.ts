import type { NextFunction, Request, Response } from "express";
import { Order, Product, Shipment } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { shipmentSchema, validate } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { assertSafeExternalUrl } from "../utils/ssrf.js";
import auditLogger from "../utils/auditLogger.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { assertAuthed } from "../types/http.js";
import { canTransitionOrder } from "../services/orderStateMachine.js";
import type { ObjectId, OrderStatus } from "../types/domain.js";
import type { ShipmentStatus } from "../models/shipment.js";

const SHIPPABLE_STATUSES: OrderStatus[] = ["confirmed", "processing", "shipped"];

// Order progress implied by one shipment. A failed shipment implies nothing (the order keeps its status).
const ORDER_RANK_FOR_SHIPMENT: Record<ShipmentStatus, number> = { pending: 1, label_created: 1, in_transit: 2, delivered: 3, failed: 0 };
const STATUS_FOR_RANK: OrderStatus[] = ["confirmed", "processing", "shipped", "delivered"];
const FULFILMENT_RANK: Partial<Record<OrderStatus, number>> = { confirmed: 0, processing: 1, shipped: 2, delivered: 3 };

// A shipment only moves forward, except that a failed one may be retried; a delivered one is final.
const SHIPMENT_RANK: Record<ShipmentStatus, number> = { pending: 0, label_created: 1, in_transit: 2, delivered: 3, failed: -1 };
export const canTransitionShipment = (from: ShipmentStatus, to: ShipmentStatus) => {
  if (from === to) return true;
  if (from === "delivered") return false;
  if (from === "failed" || to === "failed") return true;
  return SHIPMENT_RANK[to] > SHIPMENT_RANK[from];
};

/**
 * The order's fulfilment is the least advanced of its line items, and each item is covered by its
 * seller's shipment or by an admin shipment for the whole order (SEC-08).
 */
const derivedOrderRank = async (order: { _id: ObjectId; items: { product: ObjectId }[] }) => {
  const [products, shipments] = await Promise.all([
    Product.find({ _id: { $in: order.items.map((item) => item.product) } }).select("_id seller").lean(),
    Shipment.find({ order: order._id }).select("seller status").lean(),
  ]);
  const sellerOf = new Map(products.map((product) => [String(product._id), String(product.seller)]));
  const rankFor = (sellerKey: string) => {
    const shipment = shipments.find((s) => String(s.seller) === sellerKey);
    return shipment ? ORDER_RANK_FOR_SHIPMENT[shipment.status] : 0;
  };
  const adminRank = rankFor("null");
  return Math.min(...order.items.map((item) => Math.max(adminRank, rankFor(sellerOf.get(String(item.product)) ?? ""))));
};

class ShipmentController {
  constructor() {
    this.upsert = this.upsert.bind(this);
  }

  async upsert(req: Request<{ orderId: string }>, res: Response, next: NextFunction) {
    const { error, value } = validate(shipmentSchema, req.body);
    if (error) return next(error);
    try {
      assertAuthed(req);
      if (value.trackingUrl) assertSafeExternalUrl(value.trackingUrl);
      const order = await Order.findOne({ _id: req.params.orderId, tenant: req.tenant });
      if (!order) return next(CustomeErrorHandler.notFound("Order not found"));
      if (order.paymentStatus !== "paid" || !SHIPPABLE_STATUSES.includes(order.status)) {
        return next(CustomeErrorHandler.conflict(`Order cannot be shipped while ${order.status}/${order.paymentStatus}`));
      }

      // Admins manage the whole-order shipment; a seller only its own, and only for its own items.
      let seller: ObjectId | null = null;
      if (req.user.role === "seller") {
        const ownItem = await Product.exists({ _id: { $in: order.items.map((item) => item.product) }, seller: req.user._id, tenant: req.tenant });
        if (!ownItem) return next(CustomeErrorHandler.forbidden("Cannot update shipment for another seller's order"));
        seller = req.user._id;
      }

      const existing = await Shipment.findOne({ order: order._id, seller }).select("status");
      if (existing && !canTransitionShipment(existing.status, value.status)) {
        return next(CustomeErrorHandler.conflict(`Shipment cannot move from ${existing.status} to ${value.status}`));
      }
      const shipment = await Shipment.findOneAndUpdate(
        // Compare-and-set on the status read above, so a concurrent update cannot be overwritten blindly.
        { order: order._id, seller, ...(existing && { status: existing.status }) },
        { ...value, order: order._id, seller, tenant: req.tenant, updatedBy: req.user._id },
        { upsert: !existing, new: true, runValidators: true }
      );
      if (!shipment) return next(CustomeErrorHandler.conflict("The shipment changed while updating; retry"));

      const nextStatus = STATUS_FOR_RANK[await derivedOrderRank(order)]!;
      if ((FULFILMENT_RANK[nextStatus] ?? 0) > (FULFILMENT_RANK[order.status] ?? -1) && canTransitionOrder(order.status, nextStatus)) {
        // Forward-only: never overwrite a status a concurrent update already moved past.
        const behind = STATUS_FOR_RANK.filter((status) => (FULFILMENT_RANK[status] ?? 0) < FULFILMENT_RANK[nextStatus]!);
        await Order.updateOne(
          { _id: order._id, status: { $in: behind } },
          { $set: { status: nextStatus, ...(nextStatus === "delivered" && { deliveredAt: new Date() }) } }
        );
      }
      auditLogger("shipment.upsert", req, { order: order._id, shipment: shipment._id, seller });
      await publishEvent({
        type: "shipment.updated",
        aggregateType: "order",
        aggregateId: order._id,
        tenant: req.tenant,
        payload: { shipment: shipment._id, status: shipment.status, seller },
        req,
      });
      return successResponse(res, shipment, "Shipment updated");
    } catch (err) {
      return next(err);
    }
  }
}

export default new ShipmentController();
