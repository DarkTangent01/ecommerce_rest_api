import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface TenantRecord extends Timestamps {
  _id: ObjectId;
  key: string;
  name: string;
  status: "active" | "suspended";
  config: {
    currency: string;
    locale: string;
    paymentProvider: string;
    /** Whether anyone may create an account in this tenant (SEC-07). */
    allowSelfSignup: boolean;
  };
}

const tenantSchema = new Schema<TenantRecord>(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "suspended"], default: "active", index: true },
    config: {
      currency: { type: String, default: "USD" },
      locale: { type: String, default: "en-US" },
      paymentProvider: { type: String, default: "manual" },
      allowSelfSignup: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model<TenantRecord>("Tenant", tenantSchema, "tenants");
