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

// Only keyed events are deduplicated. The previous `sparse` index still indexed every un-keyed
// event as (type, null), because a compound sparse index skips a document only when all of its
// fields are missing, so a second event of any type failed with E11000 (SEC-12). Existing
// databases need `yarn migrate:domain-event-index` to drop the old index.
export const DOMAIN_EVENT_KEY_INDEX = "type_1_idempotencyKey_1_keyed";
domainEventSchema.index(
  { type: 1, idempotencyKey: 1 },
  { name: DOMAIN_EVENT_KEY_INDEX, unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

export default mongoose.model<DomainEventRecord>("DomainEvent", domainEventSchema, "domainEvents");
