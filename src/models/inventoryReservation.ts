import mongoose from "mongoose";
import type { InventoryReservation } from "../types/domain.js";
const Schema = mongoose.Schema;

const inventoryReservationSchema = new Schema<InventoryReservation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    variantSku: { type: String, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["reserved", "committed", "released", "expired"], default: "reserved", index: true },
    // Not a TTL index: MongoDB would delete the document without returning its stock (audit C2).
    // Expired reservations are released by services/inventoryService#releaseExpiredReservations.
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

inventoryReservationSchema.index({ status: 1, expiresAt: 1 });

export default mongoose.model<InventoryReservation>("InventoryReservation", inventoryReservationSchema, "inventoryReservations");
