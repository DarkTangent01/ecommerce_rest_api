import mongoose from "mongoose";
const Schema = mongoose.Schema;

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin", "seller"], default: "user", index: true },
    isActive: { type: Boolean, default: true, index: true },
    tenant: { type: String, default: "default", index: true },
    deletedAt: { type: Date, default: null, index: true },
    mfaEnabled: { type: Boolean, default: false },
    mfaVerifiedAt: Date,
  },
  { timestamps: true, optimisticConcurrency: true }
);

userSchema.set("toJSON", {
  transform(doc, ret) {
    delete ret.password;
    delete ret.__v;
    return ret;
  },
});

export default mongoose.model("User", userSchema, "users");
