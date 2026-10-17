import type { NextFunction, Request, Response } from "express";
import { Order, Product, Shipment } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { shipmentSchema, validate } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { assertSafeExternalUrl } from "../utils/ssrf.js";
import auditLogger from "../utils/auditLogger.js";
import { publishEvent } from "../infra/events/eventBus.js";
import { assertAuthed } from "../types/http.js";
import type { OrderStatus } from "../types/domain.js";
import type { ShipmentStatus } from "../models/shipment.js";

const SHIPPABLE_STATUSES: OrderStatus[] = ["confirmed", "processing", "shipped"];

// Previously every shipment update except "delivered" marked the order shipped, including a
// just-created label or a failed delivery. A failed shipment leaves the order status alone.
const ORDER_STATUS_FOR_SHIPMENT: Record<ShipmentStatus, OrderStatus | null> = {
  pending: "processing",
  label_created: "processing",
  in_transit: "shipped",
  delivered: "delivered",
  failed: null,
};

// Shipment updates only ever move an order forward.
const FULFILMENT_RANK: Partial<Record<OrderStatus, number>> = { confirmed: 0, processing: 1, shipped: 2, delivered: 3 };

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
      if (req.user.role === "seller") {
        const sellerProductIds = await Product.find({ seller: req.user._id, tenant: req.tenant }).distinct("_id");
        const hasSellerItem = order.items.some((item) => sellerProductIds.some((id) => String(id) === String(item.product)));
        if (!hasSellerItem) return next(CustomeErrorHandler.forbidden("Cannot update shipment for another seller's order"));
      }
      const shipment = await Shipment.findOneAndUpdate(
        { order: order._id, tenant: req.tenant },
        { ...value, tenant: req.tenant, updatedBy: req.user._id },
        { upsert: true, new: true, runValidators: true }
      );
      const nextStatus = ORDER_STATUS_FOR_SHIPMENT[value.status];
      if (nextStatus && FULFILMENT_RANK[nextStatus]! > (FULFILMENT_RANK[order.status] ?? -1)) {
        order.status = nextStatus;
        await order.save();
      }
      auditLogger("shipment.upsert", req, { order: order._id, shipment: shipment._id });
      await publishEvent({
        type: "shipment.updated",
        aggregateType: "order",
        aggregateId: order._id,
        tenant: req.tenant,
        payload: { shipment: shipment._id, status: shipment.status },
        req,
      });
      return successResponse(res, shipment, "Shipment updated");
    } catch (err) {
      return next(err);
    }
  }
}

export default new ShipmentController();
