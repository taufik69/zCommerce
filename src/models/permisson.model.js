const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    permissionName: { type: String, required: true, unique: true },
    actions: [
      {
        type: String,
        enum: ["view", "add", "delete", "update"],
        default: ["view"],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
