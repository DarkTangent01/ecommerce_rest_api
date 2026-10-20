import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface SagaStep {
  name: string;
  status: "pending" | "completed" | "failed";
  completedAt?: Date;
}

export interface SagaInstanceRecord extends Timestamps {
  _id: ObjectId;
  type: string;
  aggregateId: ObjectId;
  tenant?: string;
  status: "running" | "completed" | "compensating" | "failed";
  steps: SagaStep[];
  compensations: { name: string; reason: string; at: Date }[];
}

const sagaInstanceSchema = new Schema<SagaInstanceRecord>(
  {
    type: { type: String, required: true, index: true },
    aggregateId: { type: Schema.Types.ObjectId, required: true, index: true },
    tenant: { type: String, index: true },
    status: { type: String, enum: ["running", "completed", "compensating", "failed"], default: "running", index: true },
    steps: [
      {
        name: String,
        status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
        completedAt: Date,
      },
    ],
    compensations: [{ name: String, reason: String, at: Date }],
  },
  { timestamps: true }
);

export default mongoose.model<SagaInstanceRecord>("SagaInstance", sagaInstanceSchema, "sagaInstances");
