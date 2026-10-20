import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export type ShipmentStatus = "pending" | "label_created" | "in_transit" | "delivered" | "failed";

export interface ShipmentRecord extends Timestamps {
  _id: ObjectId;
  order: ObjectId;
  /** The seller this shipment covers; null for an admin shipment covering the whole order. */
  seller: ObjectId | null;
  tenant: string;
  carrier?: string;
  trackingNumber?: string;
  status: ShipmentStatus;
  trackingUrl?: string;
  updatedBy?: ObjectId;
}

const shipmentSchema = new Schema<ShipmentRecord>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    seller: { type: Schema.Types.ObjectId, ref: "User", default: null },
    tenant: { type: String, default: "default", index: true },
    carrier: { type: String, trim: true, maxlength: 80 },
    trackingNumber: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ["pending", "label_created", "in_transit", "delivered", "failed"], default: "pending" },
    trackingUrl: { type: String, trim: true, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// One shipment per seller per order (SEC-08). It used to be one per order, so any seller with one
// item could overwrite the tracking for, and deliver, every other seller's items.
export const SHIPMENT_KEY_INDEX = "order_1_seller_1";
shipmentSchema.index({ order: 1, seller: 1 }, { name: SHIPMENT_KEY_INDEX, unique: true });

export default mongoose.model<ShipmentRecord>("Shipment", shipmentSchema, "shipments");
