const mongoose = require("mongoose");

const smsLogSchema = new mongoose.Schema(
  {
    jobId: { type: String, default: "" },
    type: {
      type: String,
      enum: ["single", "bulk"],
      required: true,
    },
    recipients: [
      {
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
        phone: { type: String },
        status: {
          type: String,
          enum: ["pending", "sent", "failed"],
          default: "pending",
        },
        error: { type: String, default: "" },
      },
    ],
    message: { type: String, required: true },
    totalCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "partial", "failed"],
      default: "queued",
    },
    triggeredBy: { type: String, default: "admin" },
  },
  { timestamps: true },
);

const SmsLog =
  mongoose.models.SmsLog || mongoose.model("SmsLog", smsLogSchema);

module.exports = SmsLog;
