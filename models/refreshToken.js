import mongoose from "mongoose";
const Schema = mongoose.Schema;

const refreshTokenSchema = new Schema(
  {
    token: { type: String, unique: true, required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model(
  "RefreshToken",
  refreshTokenSchema,
  "refreshToken"
);
