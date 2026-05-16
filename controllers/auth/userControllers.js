import { Cart, Order, Review, User, Wishlist } from "../../models/index.js";
import { CustomeErrorHandler } from "../../services/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import auditLogger from "../../utils/auditLogger.js";

const userControllers = {
  async users(req, res, next) {
    try {
      const user = await User.findById(req.user._id);
      if (!user) {
        return next(CustomeErrorHandler.notFound());
      }

      return successResponse(res, user, "User profile");
    } catch (err) {
      return next(err);
    }
  },

  async exportData(req, res, next) {
    try {
      const [user, orders, cart, wishlist, reviews] = await Promise.all([
        User.findById(req.user._id),
        Order.find({ user: req.user._id }),
        Cart.findOne({ user: req.user._id }),
        Wishlist.findOne({ user: req.user._id }),
        Review.find({ user: req.user._id }),
      ]);
      return successResponse(res, { user, orders, cart, wishlist, reviews }, "User data export");
    } catch (err) {
      return next(err);
    }
  },

  async deleteData(req, res, next) {
    try {
      await User.updateOne({ _id: req.user._id }, { $set: { deletedAt: new Date(), isActive: false, email: `deleted-${req.user._id}@example.invalid`, name: "Deleted User" } });
      auditLogger("user.gdpr_delete", req, { user: req.user._id });
      return successResponse(res, null, "User data deletion requested");
    } catch (err) {
      return next(err);
    }
  },
};

export default userControllers;
