import mongoose from "mongoose";
const Schema = mongoose.Schema;

const apiKeySchema = new Schema(
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

export default mongoose.model("ApiKey", apiKeySchema, "apiKeys");
