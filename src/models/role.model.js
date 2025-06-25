const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, default: "user" },
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Role", roleSchema);
