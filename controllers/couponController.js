import { Coupon } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { couponSchema } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import auditLogger from "../utils/auditLogger.js";

const couponController = {
  async index(req, res, next) {
    try {
      const coupons = await Coupon.find({ tenant: req.tenant, deletedAt: null }).sort("-createdAt");
      return successResponse(res, coupons, "Coupons fetched");
    } catch (err) {
      return next(err);
    }
  },

  async store(req, res, next) {
    const { error, value } = couponSchema.validate(req.body);
    if (error) return next(error);
    try {
      const coupon = await Coupon.create({ ...value, tenant: req.tenant, createdBy: req.user._id });
      auditLogger("coupon.create", req, { coupon: coupon._id, code: coupon.code });
      return successResponse(res, coupon, "Coupon created", 201);
    } catch (err) {
      if (err.code === 11000) return next(CustomeErrorHandler.alreadyExist("Coupon code already exists"));
      return next(err);
    }
  },

  async update(req, res, next) {
    const { error, value } = couponSchema.validate(req.body);
    if (error) return next(error);
    try {
      const coupon = await Coupon.findOneAndUpdate({ _id: req.params.id, tenant: req.tenant, deletedAt: null }, value, { new: true, runValidators: true });
      if (!coupon) return next(CustomeErrorHandler.notFound("Coupon not found"));
      auditLogger("coupon.update", req, { coupon: coupon._id });
      return successResponse(res, coupon, "Coupon updated");
    } catch (err) {
      return next(err);
    }
  },
};

export default couponController;
