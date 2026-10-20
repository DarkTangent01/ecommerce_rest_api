import type { NextFunction, Request, Response } from "express";
import { Order, Product, Review, User } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { roundMoney } from "../utils/money.js";

class AnalyticsController {
  constructor() {
    this.admin = this.admin.bind(this);
  }

  async admin(req: Request, res: Response, next: NextFunction) {
    try {
      // Scoped to the admin's tenant; these figures used to cover every tenant in the database.
      const tenant = req.tenant;
      const [users, products, orders, revenue, reviews] = await Promise.all([
        User.countDocuments({ tenant }),
        Product.countDocuments({ tenant }),
        Order.countDocuments({ tenant }),
        Order.aggregate<{ total: number }>([{ $match: { tenant, paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
        Review.countDocuments({ tenant }),
      ]);
      return successResponse(
        res,
        {
          users,
          products,
          orders,
          revenue: roundMoney(revenue[0]?.total || 0),
          reviews,
        },
        "Admin analytics fetched"
      );
    } catch (err) {
      return next(err);
    }
  }
}

export default new AnalyticsController();
