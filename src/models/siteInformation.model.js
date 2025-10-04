const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const siteInformationSchema = new mongoose.Schema(
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
      type: String,
      trim: true,
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
  },
  {
    timestamps: true,
  }
);

// make a slug
siteInformationSchema.pre("save", function (next) {
  if (this.isModified("storeName")) {
    this.slug = slugify(this.storeName, { lower: true, strict: true });
  }
  next();
});

// if slug already exist
siteInformationSchema.pre("save", async function (next) {
  const existSiteInformation = await this.constructor.findOne({
    slug: this.slug,
  });
  if (
    existSiteInformation &&
    existSiteInformation._id &&
    existSiteInformation._id.toString() !== this._id.toString()
  ) {
    console.log(`${this.storeName} already exists Try another`);
    throw new customError(`${this.storeName} already exists Try another`, 400);
  }
  next();
});

module.exports = mongoose.model("SiteInformation", siteInformationSchema);
