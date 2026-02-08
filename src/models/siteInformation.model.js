const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

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
  },
  {
    timestamps: true,
  },
);

// make a slug
siteInformationSchema.pre("save", function (next) {
  if (this.isModified("storeName")) {
    this.slug = slugify(this.storeName, { lower: true, strict: true });
  }
  next();
});

// did not put double siteinformation only take one siteinformation
siteInformationSchema.pre("save", async function (next) {
  try {
    const siteInformationCount = await this.constructor.countDocuments();
    if (siteInformationCount >= 1 && this.isNew) {
      return next(
        new customError(
          "Only one SiteInformation document is allowed.",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// if slug already exist
siteInformationSchema.pre("save", async function (next) {
  try {
    const existSiteInformation = await this.constructor.findOne({
      slug: this.slug,
    });
    if (
      existSiteInformation &&
      existSiteInformation._id &&
      existSiteInformation._id.toString() !== this._id.toString()
    ) {
      next(
        new customError(
          `${this.storeName} already exists Try another`,
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
  mongoose.models.SiteInformation ||
  mongoose.model("SiteInformation", siteInformationSchema);
