import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface UserSessionRecord extends Timestamps {
  _id: ObjectId;
  user: ObjectId;
  refreshToken?: ObjectId;
  deviceId: string;
  userAgent?: string;
  ip?: string;
  riskScore: number;
  stepUpRequired: boolean;
  lastSeenAt: Date;
  revokedAt?: Date;
}

const userSessionSchema = new Schema<UserSessionRecord>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshToken: { type: Schema.Types.ObjectId, ref: "RefreshToken", index: true },
    deviceId: { type: String, required: true, index: true },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, index: true },
    riskScore: { type: Number, default: 0 },
    stepUpRequired: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: Date.now },
    revokedAt: Date,
  },
  { timestamps: true }
);

userSessionSchema.index({ user: 1, deviceId: 1 });

export default mongoose.model<UserSessionRecord>("UserSession", userSessionSchema, "userSessions");
