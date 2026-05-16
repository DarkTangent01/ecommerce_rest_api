import mongoose from "mongoose";
const Schema = mongoose.Schema;

const auditLogSchema = new Schema(
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

export default mongoose.model("AuditLog", auditLogSchema, "auditLogs");
