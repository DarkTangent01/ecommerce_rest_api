import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface NotificationRecord extends Timestamps {
  _id: ObjectId;
  user?: ObjectId;
  tenant: string;
  channel: "email" | "sms" | "webhook";
  template: string;
  payload: Record<string, unknown>;
  status: "queued" | "sent" | "failed";
  attempts: number;
}

const notificationSchema = new Schema<NotificationRecord>(
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

export default mongoose.model<NotificationRecord>("Notification", notificationSchema, "notifications");
