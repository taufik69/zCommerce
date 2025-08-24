const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

const merchantSchema = new mongoose.Schema({
  merchantID: { type: String, required: true, unique: true },
  merchantSecret: { type: String, required: true },
  baseURL: { type: String, required: true },
  serviceProvider: { type: String, required: true },
  merchantName: { type: String, required: true },
  merchantEmail: { type: String, required: true },
  merchantPhone: { type: String, required: true },
  merchantsecondary_contact: { type: String, required: true },
  merchantAdress: String,
  merchantcity_id: String,
  merchantzone_id: String,
  merchantarea_id: String,
  password: { type: String, trim: true },
  slug: { type: String, unique: true },
  access_token: { type: String, trim: true },
  refresh_token: { type: String, trim: true },
  token_expiry: { type: Date },
});

merchantSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("merchantName")) {
    // Generate slug from merchantName
    this.slug = slugify(this.merchantName, { lower: true, strict: true });
  }

  next();
});

// check if slug and marchantId already exist or not
merchantSchema.pre("save", async function (next) {
  const existingMerchant = await this.constructor.findOne({
    $or: [{ slug: this.slug }, { merchantID: this.merchantID }],
  });

  if (
    existingMerchant &&
    existingMerchant._id.toString() !== this._id.toString()
  ) {
    throw new customError("Merchant ID or slug already exists", 400);
  }

  next();
});
module.exports =
  mongoose.models.Merchant || mongoose.model("Merchant", merchantSchema);
