const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const outletInformationSchema = new mongoose.Schema(
  {
    locationName: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    managerMobile: {
      type: String,
      required: true,
      trim: true,
    },
    managerName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      required: true,
    },
    businessHour: {
      type: String,
      trim: true,
      default: "10:00 AM - 08:00 PM",
    },
    offDay: {
      type: String,
      trim: true,
      default: "Friday",
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Generate slug before saving

outletInformationSchema.pre("save", function (next) {
  if (this.isModified("locationName")) {
    this.slug = slugify(this.locationName, { lower: true, strict: true });
  }
  next();
});

// Check duplicate slug

outletInformationSchema.pre("save", async function (next) {
  try {
    const existingOutlet = await this.constructor.findOne({ slug: this.slug });
    if (
      existingOutlet &&
      existingOutlet._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          `Outlet with slug "${this.slug}" or location name "${this.locationName}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Update slug when findOneAndUpdate

outletInformationSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.locationName) {
    update.slug = slugify(update.locationName, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.OutletInformation ||
  mongoose.model("OutletInformation", outletInformationSchema);
