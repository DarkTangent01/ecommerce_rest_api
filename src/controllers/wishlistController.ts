import type { NextFunction, Request, Response } from "express";
import { Product, Wishlist } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { assertAuthed } from "../types/http.js";

const PRODUCT_FIELDS = "name price image stock ratingAverage ratingCount";

class WishlistController {
  constructor() {
    this.show = this.show.bind(this);
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
  }

  async show(req: Request, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const wishlist = await Wishlist.findOne({ user: req.user._id, tenant: req.tenant }).populate("products", PRODUCT_FIELDS);
      return successResponse(res, wishlist || { user: req.user._id, products: [] }, "Wishlist fetched");
    } catch (err) {
      return next(err);
    }
  }

  async add(req: Request<{ productId: string }>, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const product = await Product.exists({ _id: req.params.productId, tenant: req.tenant, isActive: true, deletedAt: null });
      if (!product) return next(CustomeErrorHandler.notFound("Product not found"));
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant },
        { $addToSet: { products: req.params.productId } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).populate("products", PRODUCT_FIELDS);
      return successResponse(res, wishlist, "Wishlist updated");
    } catch (err) {
      return next(err);
    }
  }

  async remove(req: Request<{ productId: string }>, res: Response, next: NextFunction) {
    try {
      assertAuthed(req);
      const wishlist = await Wishlist.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant },
        { $pull: { products: req.params.productId } },
        { new: true }
      ).populate("products", PRODUCT_FIELDS);
      return successResponse(res, wishlist || { user: req.user._id, products: [] }, "Wishlist updated");
    } catch (err) {
      return next(err);
    }
  }
}

export default new WishlistController();
