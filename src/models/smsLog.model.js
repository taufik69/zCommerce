const mongoose = require("mongoose");

const smsLogSchema = new mongoose.Schema(
  {
    jobId: { type: String, default: "" },
    type: {
      type: String,
      enum: ["single", "bulk"],
      required: true,
    },
    // Recipient group this campaign targeted.
    // "due" is kept for the legacy due-SMS flow (Listed customers with dues).
    recipientType: {
      type: String,
      enum: ["logged", "order", "sales", "due"],
      default: "due",
    },
    recipients: [
      {
        customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
        name: { type: String, default: "" },
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
    sentBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    sentByName: { type: String, default: "admin" },
  },
  { timestamps: true },
);

smsLogSchema.index({ recipientType: 1, createdAt: -1 });

const SmsLog =
  mongoose.models.SmsLog || mongoose.model("SmsLog", smsLogSchema);

module.exports = SmsLog;
