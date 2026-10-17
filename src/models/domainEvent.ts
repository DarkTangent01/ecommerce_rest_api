import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface DomainEventRecord extends Timestamps {
  _id: ObjectId;
  type: string;
  aggregateType: string;
  aggregateId?: ObjectId;
  tenant?: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  causationId?: string;
  idempotencyKey?: string;
  status: "pending" | "processed" | "failed";
  processedAt?: Date;
}

const domainEventSchema = new Schema<DomainEventRecord>(
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

export default mongoose.model<DomainEventRecord>("DomainEvent", domainEventSchema, "domainEvents");
