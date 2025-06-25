const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    PermissionName: { type: String, required: true, unique: true },
    PermissionValue: [String], // can be view , add , delete , delete
  },
  { timestamps: true }
);

module.exports = mongoose.model("Permission", permissionSchema);
