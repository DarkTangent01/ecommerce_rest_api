import { Order, Product, Review, User } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";

const analyticsController = {
  async admin(req, res, next) {
    try {
      const [users, products, orders, revenue, reviews] = await Promise.all([
        User.countDocuments(),
        Product.countDocuments(),
        Order.countDocuments(),
        Order.aggregate([{ $match: { paymentStatus: "paid" } }, { $group: { _id: null, total: { $sum: "$total" } } }]),
        Review.countDocuments(),
      ]);
      return successResponse(res, {
        users,
        products,
        orders,
        revenue: revenue[0]?.total || 0,
        reviews,
      }, "Admin analytics fetched");
    } catch (err) {
      return next(err);
    }
  },
};

export default analyticsController;
