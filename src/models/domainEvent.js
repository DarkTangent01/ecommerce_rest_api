import mongoose from "mongoose";
const Schema = mongoose.Schema;

const domainEventSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    aggregateType: { type: String, required: true, index: true },
    aggregateId: { type: Schema.Types.ObjectId, index: true },
    tenant: { type: String, index: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    correlationId: String,
    causationId: String,
    idempotencyKey: String,
    status: { type: String, enum: ["pending", "processed", "failed"], default: "pending", index: true },
    processedAt: Date,
  },
  { timestamps: true }
);

domainEventSchema.index({ type: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

export default mongoose.model("DomainEvent", domainEventSchema, "domainEvents");
