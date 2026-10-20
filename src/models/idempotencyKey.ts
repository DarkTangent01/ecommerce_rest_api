import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface IdempotencyKeyRecord extends Timestamps {
  _id: ObjectId;
  key: string;
  user: ObjectId;
  route: string;
  requestHash: string;
  response?: unknown;
  statusCode?: number;
  status: "processing" | "completed" | "failed";
  expiresAt: Date;
}

const idempotencyKeySchema = new Schema<IdempotencyKeyRecord>(
  {
    key: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    route: { type: String, required: true },
    requestHash: { type: String, required: true },
    response: { type: Schema.Types.Mixed },
    statusCode: { type: Number },
    status: { type: String, enum: ["processing", "completed", "failed"], default: "processing" },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

idempotencyKeySchema.index({ key: 1, user: 1, route: 1 }, { unique: true });

export default mongoose.model<IdempotencyKeyRecord>("IdempotencyKey", idempotencyKeySchema, "idempotencyKeys");
