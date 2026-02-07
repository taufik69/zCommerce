const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

const permissionSchema = new mongoose.Schema(
  {
    slug: { type: String },
    permissionName: {
      type: String,
      required: [true, "Permission name is required"],
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// For save()
permissionSchema.pre("save", function (next) {
  if (this.isModified("permissionName")) {
    this.slug = slugify(this.permissionName, { lower: true, strict: true });
  }
  next();
});

// For insertMany()
permissionSchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    doc.slug = slugify(doc.permissionName, { lower: true, strict: true });
  });
  next();
});

//  Unique Slug Check (works for save & insertMany both)
permissionSchema.pre("save", async function (next) {
  try {
    const existingPermission = await this.constructor.findOne({
      slug: this.slug,
    });
    if (
      existingPermission &&
      existingPermission._id.toString() !== this._id.toString()
    ) {
      return next(new customError("Permission name already exists", 400));
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.Permission || mongoose.model("Permission", permissionSchema);
