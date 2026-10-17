import mongoose from "mongoose";
const Schema = mongoose.Schema;

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, trim: true, maxlength: 120 },
    comment: { type: String, trim: true, maxlength: 2000 },
    status: { type: String, enum: ["published", "hidden", "flagged"], default: "published", index: true },
  },
  { timestamps: true }
);

reviewSchema.index({ tenant: 1, user: 1, product: 1 }, { unique: true });
reviewSchema.index({ tenant: 1, product: 1, status: 1, createdAt: -1 });

export default mongoose.model("Review", reviewSchema, "reviews");
