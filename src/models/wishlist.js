import mongoose from "mongoose";
const Schema = mongoose.Schema;

const wishlistSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

wishlistSchema.index({ tenant: 1, user: 1 }, { unique: true });

export default mongoose.model("Wishlist", wishlistSchema, "wishlists");
