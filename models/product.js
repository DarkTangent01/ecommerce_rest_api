import mongoose from "mongoose";
import { APP_URL } from "../config/index.js";
const Schema = mongoose.Schema;

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    description: { type: String, trim: true, maxlength: 3000, default: "" },
    price: { type: Number, required: true, min: 0 },
    size: { type: String, required: false, trim: true, uppercase: true, maxlength: 30 },
    category: { type: String, trim: true, maxlength: 80, index: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    stock: { type: Number, min: 0, default: 0, index: true },
    variants: [
      {
        size: { type: String, trim: true, uppercase: true, maxlength: 30 },
        color: { type: String, trim: true, maxlength: 40 },
        sku: { type: String, trim: true, uppercase: true },
        price: { type: Number, min: 0 },
        stock: { type: Number, min: 0, default: 0 },
      },
    ],
    ratingAverage: { type: Number, min: 0, max: 5, default: 0, index: true },
    ratingCount: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: "User", index: true },
    tenant: { type: String, default: "default", index: true },
    deletedAt: { type: Date, default: null, index: true },
    image: {
      type: String,
      required: true,
      get: (image) => {
        if (!image) return image;
        if (/^https?:\/\//.test(image)) return image;
        return `${APP_URL}/${image.replace(/\\/g, "/")}`;
      },
    },
  },
  { timestamps: true, toJSON: { getters: true }, id: false, optimisticConcurrency: true }
);

productSchema.index({ name: "text", description: "text", category: "text", sku: "text" });
productSchema.index({ price: 1, createdAt: -1 });
productSchema.index({ tenant: 1, isActive: 1, category: 1, createdAt: -1 });
productSchema.index({ tenant: 1, seller: 1, deletedAt: 1 });

export default mongoose.model("Product", productSchema, "products");
