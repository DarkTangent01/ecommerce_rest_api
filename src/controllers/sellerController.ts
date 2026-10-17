import type { NextFunction, Request, Response } from "express";
import { Order, Product } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { assertAuthed } from "../types/http.js";
import { fromCents, toCents } from "../utils/money.js";

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
      const orders = await Order.find({ tenant: req.tenant, "items.product": { $in: productIds } })
        .sort("-createdAt")
        .limit(50);
      const revenueCents = orders
        .filter((order) => order.paymentStatus === "paid")
        .reduce(
          (sum, order) =>
            sum +
            order.items
              .filter((item) => productIds.some((id) => String(id) === String(item.product)))
              .reduce((lineSum, item) => lineSum + toCents(item.price) * item.quantity, 0),
          0
        );
      const revenue = fromCents(revenueCents);

      return successResponse(
        res,
        {
          productCount: products.length,
          recentOrders: orders,
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
