import mongoose from "mongoose";
const Schema = mongoose.Schema;

const orderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, min: 0 },
    discountTotal: { type: Number, min: 0, default: 0 },
    coupon: { type: Schema.Types.ObjectId, ref: "Coupon" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "refund_requested", "refunded"],
      default: "pending",
      index: true,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "authorized", "paid", "failed", "refunded"],
      default: "unpaid",
      index: true,
    },
    refundStatus: {
      type: String,
      enum: ["none", "requested", "approved", "rejected", "processed"],
      default: "none",
    },
    paymentProvider: { type: String, trim: true, maxlength: 80 },
    paymentReference: { type: String, trim: true, maxlength: 160 },
    paymentStateHistory: [
      {
        from: String,
        to: String,
        at: { type: Date, default: Date.now },
        reason: String,
      },
    ],
    shippingAddress: {
      line1: { type: String, required: true, maxlength: 160 },
      line2: { type: String, maxlength: 160 },
      city: { type: String, required: true, maxlength: 80 },
      state: { type: String, required: true, maxlength: 80 },
      postalCode: { type: String, required: true, maxlength: 20 },
      country: { type: String, required: true, maxlength: 80 },
    },
    cancelledAt: Date,
    cancellationReason: { type: String, maxlength: 300 },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
);

orderSchema.index({ createdAt: -1 });
orderSchema.index({ tenant: 1, user: 1, createdAt: -1 });
orderSchema.index({ tenant: 1, status: 1, paymentStatus: 1 });

export default mongoose.model("Order", orderSchema, "orders");
