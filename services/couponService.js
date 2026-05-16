import { Coupon, CouponRedemption } from "../models/index.js";
import { CustomeErrorHandler } from "./index.js";

export const calculateDiscount = (coupon, subtotal) => {
  if (!coupon) return 0;
  const raw = coupon.type === "percentage" ? subtotal * (coupon.value / 100) : coupon.value;
  return Math.min(raw, coupon.maxDiscount || raw, subtotal);
};

export const validateCouponForUser = async (code, userId, subtotal, session, tenant = "default") => {
  if (!code) return { coupon: null, discount: 0 };

  const now = new Date();
  const coupon = await Coupon.findOne({ code, isActive: true, tenant, deletedAt: null }).session(session);
  if (!coupon) throw CustomeErrorHandler.badRequest("Invalid coupon");
  if (coupon.startsAt && coupon.startsAt > now) throw CustomeErrorHandler.badRequest("Coupon is not active yet");
  if (coupon.expiresAt && coupon.expiresAt < now) throw CustomeErrorHandler.badRequest("Coupon has expired");
  if (subtotal < coupon.minOrderTotal) throw CustomeErrorHandler.badRequest("Order total is too low for this coupon");
  if (coupon.usedCount >= coupon.usageLimit) throw CustomeErrorHandler.badRequest("Coupon usage limit reached");

  const userUses = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId }).session(session);
  if (userUses >= coupon.perUserLimit) throw CustomeErrorHandler.badRequest("Coupon already used by this account");

  return { coupon, discount: calculateDiscount(coupon, subtotal) };
};
