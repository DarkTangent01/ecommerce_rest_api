import mongoose from "mongoose";
const Schema = mongoose.Schema;

const documentVersionSchema = new Schema(
  {
    collectionName: { type: String, required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, required: true, index: true },
    version: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    changedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reason: String,
  },
  { timestamps: true }
);

documentVersionSchema.index({ collectionName: 1, documentId: 1, version: 1 }, { unique: true });

export default mongoose.model("DocumentVersion", documentVersionSchema, "documentVersions");
