import mongoose from "mongoose";
import type { ObjectId, Timestamps } from "../types/domain.js";
const Schema = mongoose.Schema;

export interface DocumentVersionRecord extends Timestamps {
  _id: ObjectId;
  collectionName: string;
  documentId: ObjectId;
  version: number;
  snapshot: unknown;
  changedBy?: ObjectId;
  reason?: string;
}

const documentVersionSchema = new Schema<DocumentVersionRecord>(
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

export default mongoose.model<DocumentVersionRecord>("DocumentVersion", documentVersionSchema, "documentVersions");
