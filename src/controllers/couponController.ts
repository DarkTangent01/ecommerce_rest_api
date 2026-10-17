import type { NextFunction, Request, Response } from "express";
import { Coupon } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { couponSchema, validate } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import auditLogger from "../utils/auditLogger.js";
import { assertAuthed } from "../types/http.js";
import { buildPagination } from "../utils/pagination.js";

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

class CouponController {
  constructor() {
    this.index = this.index.bind(this);
    this.store = this.store.bind(this);
    this.update = this.update.bind(this);
  }

  async index(req: Request, res: Response, next: NextFunction) {
    try {
      // Paginated (default 50, max 100): this list was unbounded.
      const { page, limit, skip } = buildPagination(req.query, { limit: 50 });
      const filter = { tenant: req.tenant, deletedAt: null };
      const [coupons, total] = await Promise.all([Coupon.find(filter).sort("-createdAt").skip(skip).limit(limit), Coupon.countDocuments(filter)]);
      return successResponse(res, coupons, "Coupons fetched", 200, { page, limit, total, pages: Math.ceil(total / limit) });
    } catch (err) {
      return next(err);
    }
  }

  async store(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(couponSchema, req.body);
    if (error) return next(error);
    try {
      assertAuthed(req);
      const coupon = await Coupon.create({ ...value, tenant: req.tenant, createdBy: req.user._id });
      auditLogger("coupon.create", req, { coupon: coupon._id, code: coupon.code });
      return successResponse(res, coupon, "Coupon created", 201);
    } catch (err) {
      if (isDuplicateKey(err)) return next(CustomeErrorHandler.alreadyExist("Coupon code already exists"));
      return next(err);
    }
  }

  async update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    const { error, value } = validate(couponSchema, req.body);
    if (error) return next(error);
    try {
      const coupon = await Coupon.findOneAndUpdate({ _id: req.params.id, tenant: req.tenant, deletedAt: null }, value, {
        new: true,
        runValidators: true,
      });
      if (!coupon) return next(CustomeErrorHandler.notFound("Coupon not found"));
      auditLogger("coupon.update", req, { coupon: coupon._id });
      return successResponse(res, coupon, "Coupon updated");
    } catch (err) {
      return next(err);
    }
  }
}

export default new CouponController();
