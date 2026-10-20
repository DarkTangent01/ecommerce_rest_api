import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface AuditLogRecord extends Timestamps {
  _id: ObjectId;
  sequence: number;
  action: string;
  actor?: ObjectId | null;
  tenant?: string;
  requestId?: string | null;
  ip?: string | null;
  metadata: Record<string, unknown>;
  previousHash: string;
  hash: string;
}

const auditLogSchema = new Schema<AuditLogRecord>(
  {
    sequence: { type: Number, required: true, unique: true, index: true },
    action: { type: String, required: true, index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User" },
    tenant: { type: String, index: true },
    requestId: String,
    ip: String,
    metadata: { type: Schema.Types.Mixed, default: {} },
    previousHash: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.model<AuditLogRecord>("AuditLog", auditLogSchema, "auditLogs");
