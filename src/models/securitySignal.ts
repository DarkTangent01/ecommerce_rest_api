import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export type SignalSeverity = "info" | "low" | "medium" | "high" | "critical";

export interface SecuritySignalRecord extends Timestamps {
  _id: ObjectId;
  type: string;
  severity: SignalSeverity;
  user?: ObjectId;
  tenant?: string;
  ip?: string;
  metadata: Record<string, unknown>;
}

const securitySignalSchema = new Schema<SecuritySignalRecord>(
  {
    type: { type: String, required: true, index: true },
    severity: { type: String, enum: ["info", "low", "medium", "high", "critical"], default: "info", index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    tenant: { type: String, index: true },
    ip: String,
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export default mongoose.model<SecuritySignalRecord>("SecuritySignal", securitySignalSchema, "securitySignals");
