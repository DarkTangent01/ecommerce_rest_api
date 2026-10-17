import mongoose from "mongoose";
const Schema = mongoose.Schema;

const couponSchema = new Schema(
  {
    code: { type: String, required: true, uppercase: true, trim: true, index: true },
    type: { type: String, enum: ["percentage", "fixed"], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscount: { type: Number, min: 0 },
    minOrderTotal: { type: Number, min: 0, default: 0 },
    usageLimit: { type: Number, min: 1, default: 1 },
    perUserLimit: { type: Number, min: 1, default: 1 },
    usedCount: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date },
    expiresAt: { type: Date },
    isActive: { type: Boolean, default: true, index: true },
    tenant: { type: String, default: "default", index: true },
    deletedAt: { type: Date, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

couponSchema.index({ tenant: 1, code: 1 }, { unique: true });

export default mongoose.model("Coupon", couponSchema, "coupons");
