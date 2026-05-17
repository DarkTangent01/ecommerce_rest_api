import { Product, Wishlist } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { successResponse } from "../utils/apiResponse.js";

class WishlistController {
  constructor() {
    this.show = this.show.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
  }

  async show(req, res, next) {
    try {
      const wishlist = await Wishlist.findOne({ user: req.user._id, tenant: req.tenant }).populate("products", "name price image stock ratingAverage ratingCount");
      return successResponse(res, wishlist || { user: req.user._id, products: [] }, "Wishlist fetched");
    } catch (err) {
      return next(err);
    }
  }

  async add(req, res, next) {
    try {
      const product = await Product.exists({ _id: req.params.productId, tenant: req.tenant, isActive: true, deletedAt: null });
      if (!product) return next(CustomeErrorHandler.notFound("Product not found"));
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant },
        { $addToSet: { products: req.params.productId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("products", "name price image stock ratingAverage ratingCount");
      return successResponse(res, wishlist, "Wishlist updated");
    } catch (err) {
      return next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant },
        { $pull: { products: req.params.productId } },
        { new: true }
      ).populate("products", "name price image stock ratingAverage ratingCount");
      return successResponse(res, wishlist || { user: req.user._id, products: [] }, "Wishlist updated");
    } catch (err) {
      return next(err);
    }
  }
}

export default new WishlistController();
