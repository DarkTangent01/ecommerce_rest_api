import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface RefreshTokenRecord extends Timestamps {
  _id: ObjectId;
  token: string;
  user: ObjectId;
  expiresAt: Date;
  revokedAt: Date | null;
}

const refreshTokenSchema = new Schema<RefreshTokenRecord>(
  {
    token: { type: String, unique: true, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model<RefreshTokenRecord>("RefreshToken", refreshTokenSchema, "refreshToken");
