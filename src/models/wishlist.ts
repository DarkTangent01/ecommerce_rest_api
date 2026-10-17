import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface WishlistRecord extends Timestamps {
  _id: ObjectId;
  user: ObjectId;
  tenant: string;
  products: ObjectId[];
}

const wishlistSchema = new Schema<WishlistRecord>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

wishlistSchema.index({ tenant: 1, user: 1 }, { unique: true });

export default mongoose.model<WishlistRecord>("Wishlist", wishlistSchema, "wishlists");
