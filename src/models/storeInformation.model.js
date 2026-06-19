const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, default: "" },
    publicId: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "processing", "uploaded", "failed"],
      default: "pending",
    },
    localPath: { type: String, default: "" },
    tries: { type: Number, default: 0 },
    lastError: { type: String, default: "" },
  },
  { _id: false },
);

const storeInformationSchema = new mongoose.Schema(
  {
    storeName: {
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
    propiterSlogan: {
      type: String,
      trim: true,
    },
    adress: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    image: {
      type: imageSchema,
      default: () => ({}),
    },
    businessHours: {
      type: String,
      trim: true,
    },
    footer: {
      type: String,
      trim: true,
    },
    facebookLink: {
      type: String,
      trim: true,
    },
    youtubeLink: {
      type: String,
      trim: true,
    },
    instagramLink: {
      type: String,
      trim: true,
    },
    whatsappLink: {
      type: String,
      trim: true,
    },
    twitterLink: {
      type: String,
      trim: true,
    },
    messengerLink: {
      type: String,
      trim: true,
    },
    linkedinLink: {
      type: String,
      trim: true,
    },
    googleMapLink: {
      type: String,
      trim: true,
    },
    qrCode: {
      type: String,
      trim: true,
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

storeInformationSchema.pre("save", function (next) {
  if (this.isModified("storeName")) {
    this.slug = slugify(this.storeName, { lower: true, strict: true });
  }
  next();
});

storeInformationSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({ slug: this.slug });
    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Store with name "${this.storeName}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.StoreInformation ||
  mongoose.model("StoreInformation", storeInformationSchema);
