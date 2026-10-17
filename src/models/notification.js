import mongoose from "mongoose";
const Schema = mongoose.Schema;

const notificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    tenant: { type: String, default: "default", index: true },
    channel: { type: String, enum: ["email", "sms", "webhook"], required: true },
    template: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: { type: String, enum: ["queued", "sent", "failed"], default: "queued", index: true },
    attempts: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema, "notifications");
