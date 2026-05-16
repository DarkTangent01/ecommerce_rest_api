import mongoose from "mongoose";
const Schema = mongoose.Schema;

const sagaInstanceSchema = new Schema(
  {
    type: { type: String, required: true, index: true },
    aggregateId: { type: Schema.Types.ObjectId, required: true, index: true },
    tenant: { type: String, index: true },
    status: { type: String, enum: ["running", "completed", "compensating", "failed"], default: "running", index: true },
    steps: [
      {
        name: String,
        status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
        completedAt: Date,
      },
    ],
    compensations: [{ name: String, reason: String, at: Date }],
  },
  { timestamps: true }
);

export default mongoose.model("SagaInstance", sagaInstanceSchema, "sagaInstances");
