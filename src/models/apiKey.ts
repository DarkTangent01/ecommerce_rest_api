import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface ApiKeyRecord extends Timestamps {
  _id: ObjectId;
  name: string;
  keyHash: string;
  tenant: string;
  scopes: string[];
  status: "active" | "revoked";
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdBy?: ObjectId;
}

const apiKeySchema = new Schema<ApiKeyRecord>(
  {
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    tenant: { type: String, required: true, index: true },
    scopes: [{ type: String, trim: true }],
    status: { type: String, enum: ["active", "revoked"], default: "active", index: true },
    lastUsedAt: Date,
    expiresAt: Date,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export default mongoose.model<ApiKeyRecord>("ApiKey", apiKeySchema, "apiKeys");
