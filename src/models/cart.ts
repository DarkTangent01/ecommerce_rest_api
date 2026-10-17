import mongoose from "mongoose";
import type { Cart, CartItem } from "../types/domain.js";
const Schema = mongoose.Schema;

const cartItemSchema = new Schema<CartItem>(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, min: 1, max: 999 },
  },
  { _id: false }
);

const cartSchema = new Schema<Cart>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    items: { type: [cartItemSchema], default: [] },
  },
  { timestamps: true }
);

cartSchema.index({ tenant: 1, user: 1 }, { unique: true });

export default mongoose.model<Cart>("Cart", cartSchema, "carts");
