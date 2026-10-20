import type { NextFunction, Request, Response } from "express";
import { Order, Product } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { assertAuthed } from "../types/http.js";
import { fromCents, toCents } from "../utils/money.js";
import type { OrderStatus } from "../types/domain.js";

/** Orders a seller still has to ship; only these show the delivery address. */
const FULFILLABLE_STATUSES = new Set<OrderStatus>(["confirmed", "processing", "shipped"]);

class SellerController {
  constructor() {
    this.dashboard = this.dashboard.bind(this);
  }

  async dashboard(req: Request, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const products = await Product.find({ seller: req.user._id, tenant: req.tenant, deletedAt: null }).select(
        "_id name stock price ratingAverage ratingCount"
      );
      const productIds = products.map((product) => product._id);
      const ownIds = new Set(productIds.map(String));
      const orders = await Order.find({ tenant: req.tenant, "items.product": { $in: productIds } })
        .sort("-createdAt")
        .limit(50)
        .select("_id status paymentStatus createdAt items shippingAddress")
        .lean();

      // Explicit DTOs (SEC-03): the full order documents exposed the customer id, totals, coupon,
      // payment history and other sellers' line items. A seller sees only its own lines, and the
      // address only while it still has to ship a paid order.
      const recentOrders = orders.map((order) => {
        const items = order.items
          .filter((item) => ownIds.has(String(item.product)))
          .map(({ product, name, price, quantity }) => ({ product, name, price, quantity }));
        const mustFulfil = order.paymentStatus === "paid" && FULFILLABLE_STATUSES.has(order.status);
        return {
          _id: order._id,
          status: order.status,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt,
          items,
          sellerSubtotal: fromCents(items.reduce((sum, item) => sum + toCents(item.price) * item.quantity, 0)),
          ...(mustFulfil && { shippingAddress: order.shippingAddress }),
        };
      });
      const revenue = fromCents(
        recentOrders.filter((order) => order.paymentStatus === "paid").reduce((sum, order) => sum + toCents(order.sellerSubtotal), 0)
      );

      return successResponse(
        res,
        {
          productCount: products.length,
          recentOrders,
          revenue,
          lowStock: products.filter((product) => product.stock <= 5),
        },
        "Seller dashboard fetched"
      );
    } catch (err) {
      return next(err);
    }
  }
}

export default new SellerController();
