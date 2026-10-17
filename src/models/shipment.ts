import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export type ShipmentStatus = "pending" | "label_created" | "in_transit" | "delivered" | "failed";

export interface ShipmentRecord extends Timestamps {
  _id: ObjectId;
  order: ObjectId;
  tenant: string;
  carrier?: string;
  trackingNumber?: string;
  status: ShipmentStatus;
  trackingUrl?: string;
  updatedBy?: ObjectId;
}

const shipmentSchema = new Schema<ShipmentRecord>(
  {
    order: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true, index: true },
    tenant: { type: String, default: "default", index: true },
    carrier: { type: String, trim: true, maxlength: 80 },
    trackingNumber: { type: String, trim: true, maxlength: 120 },
    status: { type: String, enum: ["pending", "label_created", "in_transit", "delivered", "failed"], default: "pending" },
    trackingUrl: { type: String, trim: true, maxlength: 500 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model<ShipmentRecord>("Shipment", shipmentSchema, "shipments");
