const mongoose = require("mongoose");

const permissionSchema = new mongoose.Schema(
  {
    PermissionName: { type: String, required: true, unique: true },
    actions: {
      type: Array,
      enum: ["view", "add", "delete", "update"],
      default: ["view"],
    }, // can be view , add , delete , delete
  },
  { timestamps: true }
);
// {
//   id:1,
//   PermissionName:"product info"
//   PermissionValue:["view","add","delete"]
// }
// {
//   id:2
//   PermissionName:"product info"
//   PermissionValue:["view"]
// }

module.exports = mongoose.model("Permission", permissionSchema);
