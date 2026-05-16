import mongoose from "mongoose";
const Schema = mongoose.Schema;

const idempotencyKeySchema = new Schema(
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

export default mongoose.model("IdempotencyKey", idempotencyKeySchema, "idempotencyKeys");
