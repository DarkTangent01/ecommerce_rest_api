import type { NextFunction, Request, Response } from "express";
import { Order, Product, Review } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { reviewSchema, validate } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import mongoose from "mongoose";
import { assertAuthed } from "../types/http.js";

const recalculateRating = async (productId: string) => {
  const stats = await Review.aggregate<{ average: number; count: number }>([
    { $match: { product: new mongoose.Types.ObjectId(productId), status: "published" } },
    { $group: { _id: "$product", average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const rating = stats[0] || { average: 0, count: 0 };
  await Product.updateOne({ _id: productId }, { $set: { ratingAverage: rating.average, ratingCount: rating.count } });
};

class ReviewController {
  constructor() {
    this.index = this.index.bind(this);
    this.create = this.create.bind(this);
  }

  async index(req: Request<{ productId: string }>, res: Response, next: NextFunction) {
    try {
      const reviews = await Review.find({ product: req.params.productId, tenant: req.tenant, status: "published" })
        .sort("-createdAt")
        .populate("user", "name");
      return successResponse(res, reviews, "Reviews fetched");
    } catch (err) {
      return next(err);
    }
  }

  async create(req: Request<{ productId: string }>, res: Response, next: NextFunction) {
    const { error, value } = validate(reviewSchema, req.body);
    if (error) return next(error);

    try {
      assertAuthed(req);
      const product = await Product.exists({ _id: req.params.productId, tenant: req.tenant, isActive: true, deletedAt: null });
      if (!product) return next(CustomeErrorHandler.notFound("Product not found"));

      const purchased = await Order.exists({
        user: req.user._id,
        tenant: req.tenant,
        "items.product": req.params.productId,
        status: { $in: ["confirmed", "processing", "shipped", "delivered"] },
      });
      if (!purchased) return next(CustomeErrorHandler.forbidden("Only verified purchasers can review this product"));

      const review = await Review.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant, product: req.params.productId },
        { ...value, tenant: req.tenant, status: "published" },
        { upsert: true, new: true, runValidators: true }
      );
      await recalculateRating(req.params.productId);
      return successResponse(res, review, "Review saved", 201);
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return next(CustomeErrorHandler.badRequest("Review already exists"));
      return next(err);
    }
  }
}

export default new ReviewController();
