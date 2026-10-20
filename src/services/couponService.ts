import type { ClientSession, Types } from "mongoose";
import { Coupon, CouponRedemption } from "../models/index.js";
import { CustomeErrorHandler } from "./index.js";
import type { Coupon as CouponShape } from "../types/domain.js";
import { percentOf, toCents, type Cents } from "../utils/money.js";

/** Discount in cents, never more than the subtotal or the coupon's cap. */
export const calculateDiscountCents = (
  coupon: Pick<CouponShape, "type" | "value" | "maxDiscount"> | null | undefined,
  subtotalCents: Cents
): Cents => {
  if (!coupon) return 0;
  const raw = coupon.type === "percentage" ? percentOf(subtotalCents, coupon.value) : toCents(coupon.value);
  // TODO: a maxDiscount of 0 is treated as "no cap" (original behaviour); confirm intent with product owners.
  const cap = coupon.maxDiscount ? toCents(coupon.maxDiscount) : raw;
  return Math.max(0, Math.min(raw, cap, subtotalCents));
};

export const validateCouponForUser = async (
  code: string | undefined,
  userId: Types.ObjectId | string,
  subtotalCents: Cents,
  session: ClientSession | null,
  tenant = "default"
) => {
  if (!code) return { coupon: null, discountCents: 0 };

  const now = new Date();
  const coupon = await Coupon.findOne({ code, isActive: true, tenant, deletedAt: null }).session(session);
  if (!coupon) throw CustomeErrorHandler.badRequest("Invalid coupon");
  if (coupon.startsAt && coupon.startsAt > now) throw CustomeErrorHandler.badRequest("Coupon is not active yet");
  if (coupon.expiresAt && coupon.expiresAt < now) throw CustomeErrorHandler.badRequest("Coupon has expired");
  if (subtotalCents < toCents(coupon.minOrderTotal)) throw CustomeErrorHandler.badRequest("Order total is too low for this coupon");
  if (coupon.usedCount >= coupon.usageLimit) throw CustomeErrorHandler.badRequest("Coupon usage limit reached");

  const userUses = await CouponRedemption.countDocuments({ coupon: coupon._id, user: userId }).session(session);
  if (userUses >= coupon.perUserLimit) throw CustomeErrorHandler.badRequest("Coupon already used by this account");

  return { coupon, discountCents: calculateDiscountCents(coupon, subtotalCents) };
};
