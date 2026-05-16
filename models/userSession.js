import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSessionSchema = new Schema(
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

export default mongoose.model("UserSession", userSessionSchema, "userSessions");
