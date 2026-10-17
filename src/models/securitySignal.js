import mongoose from "mongoose";
const Schema = mongoose.Schema;

const securitySignalSchema = new Schema(
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

export default mongoose.model("SecuritySignal", securitySignalSchema, "securitySignals");
