import mongoose from "mongoose";
import type { Payment } from "../types/domain.js";
const Schema = mongoose.Schema;

const paymentEventSchema = new Schema<Payment>(
  {
    provider: { type: String, required: true, index: true },
    eventId: { type: String, required: true },
    order: { type: Schema.Types.ObjectId, ref: "Order", index: true },
    type: { type: String, required: true },
    payloadHash: { type: String, required: true },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });

export default mongoose.model<Payment>("PaymentEvent", paymentEventSchema, "paymentEvents");
