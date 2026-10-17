import mongoose from "mongoose";
const Schema = mongoose.Schema;

const tenantSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    config: {
      currency: { type: String, default: "USD" },
      locale: { type: String, default: "en-US" },
      paymentProvider: { type: String, default: "manual" },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Tenant", tenantSchema, "tenants");
