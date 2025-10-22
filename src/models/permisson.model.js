const mongoose = require("mongoose");
const slugify = require("slugify");
const permissionSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true },
    permissionName: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

//make a permissonName slug using slugify
permissionSchema.pre("save", function (next) {
  if (this.isModified("permissionName")) {
    this.slug = slugify(this.permissionName, { lower: true, strict: true });
  }
  next();
});

// check this slug already exist or not
permissionSchema.pre("save", async function (next) {
  const existingPermission = await this.constructor.findOne({
    slug: this.slug,
  });
  if (
    existingPermission &&
    existingPermission._id.toString() !== this._id.toString()
  ) {
    console.log(
      `Permission with slug ${this.slug} or name ${this.permissionName} already exists`
    );
    throw new Error(
      `Permission with slug ${this.slug} or name ${this.permissionName} already exists`
    );
  }
  next();
});

module.exports = mongoose.model("Permission", permissionSchema);
