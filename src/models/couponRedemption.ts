import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface CouponRedemptionRecord extends Timestamps {
  _id: ObjectId;
  coupon: ObjectId;
  tenant: string;
  user: ObjectId;
  order?: ObjectId;
}

const couponRedemptionSchema = new Schema<CouponRedemptionRecord>(
  {
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },
  },
  { timestamps: true }
);

couponRedemptionSchema.index({ tenant: 1, coupon: 1, user: 1, order: 1 }, { unique: true, sparse: true });

export default mongoose.model<CouponRedemptionRecord>("CouponRedemption", couponRedemptionSchema, "couponRedemptions");
