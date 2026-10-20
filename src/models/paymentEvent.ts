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
    /** sha256 of exactly what the HMAC covers (timestamp + raw body); absent on rows from before SEC-11. */
    signedDigest: { type: String },
    receivedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

paymentEventSchema.index({ provider: 1, eventId: 1 }, { unique: true });
// The event id and provider headers are not signed, so a captured webhook could be replayed under a
// new id. Deduplicating on the signed content closes that (SEC-11).
paymentEventSchema.index({ signedDigest: 1 }, { unique: true, sparse: true });

export default mongoose.model<Payment>("PaymentEvent", paymentEventSchema, "paymentEvents");
