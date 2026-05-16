import mongoose from "mongoose";
const Schema = mongoose.Schema;

const inventoryReservationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenant: { type: String, default: "default", index: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true, index: true },
    variantSku: { type: String, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["reserved", "committed", "released", "expired"], default: "reserved", index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryReservation", inventoryReservationSchema, "inventoryReservations");
