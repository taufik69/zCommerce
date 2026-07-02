const mongoose = require("mongoose");

const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "STATUS_CHANGE",
  "STOCK_ADJUST",
  "PAYMENT",
  "REFUND",
];

const auditLogSchema = new mongoose.Schema(
  {
    // Denormalized snapshot — must reflect the user's role at the time of the action
    user: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      roles: [{ type: String }],
    },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    entity: {
      type: { type: String, required: true, lowercase: true, trim: true },
      id: { type: mongoose.Schema.Types.ObjectId },
      label: { type: String, default: "" },
    },
    // UPDATE / STATUS_CHANGE: compact field-level diff
    changes: {
      type: [
        {
          _id: false,
          field: { type: String },
          before: { type: mongoose.Schema.Types.Mixed },
          after: { type: mongoose.Schema.Types.Mixed },
        },
      ],
      default: undefined,
    },
    // CREATE stores `after`, DELETE stores `before` (redacted + size-capped)
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    meta: {
      ip: { type: String, default: "" },
      userAgent: { type: String, default: "" },
      method: { type: String, default: "" },
      path: { type: String, default: "" },
      requestId: { type: String, default: "" },
    },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);

// Entity timeline: "history of this order/product"
auditLogSchema.index({ "entity.type": 1, "entity.id": 1, createdAt: -1 });
// User activity feed: "what did this user do"
auditLogSchema.index({ "user.id": 1, createdAt: -1 });
// "all deletes last week"
auditLogSchema.index({ action: 1, createdAt: -1 });
// Module-level browsing without an entity id
auditLogSchema.index({ "entity.type": 1, createdAt: -1 });
// Retention: auto-purge after 180 days
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 180 });

// Audit logs are write-only — block mutation even from app code
auditLogSchema.pre(
  [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ],
  function () {
    throw new Error("Audit logs are immutable");
  },
);

module.exports = {
  auditLogModel: mongoose.model("auditlog", auditLogSchema),
  AUDIT_ACTIONS,
};
