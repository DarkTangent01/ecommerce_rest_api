import mongoose from "mongoose";
const Schema = mongoose.Schema;

const shipmentSchema = new Schema(
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

export default mongoose.model("Shipment", shipmentSchema, "shipments");
