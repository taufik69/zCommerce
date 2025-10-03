const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");

const merchantSchema = new mongoose.Schema({
  merchantID: { type: String, required: true, unique: true },
  merchantSecret: { type: String, required: true },
  baseURL: { type: String, required: true },
  serviceProvider: { type: String, required: true },
  store_id: { type: Number, default: null },
  webhookSecret: { type: String, default: null },
  access_token: { type: String, trim: true },
  refresh_token: { type: String, trim: true },
  token_expiry: { type: Date },
  isActive: { type: Boolean, default: true },
});

// Ensure uniqueness of slug and merchantID
merchantSchema.pre("save", async function (next) {
  const existingMerchant = await this.constructor.findOne({
    $or: [{ merchantID: this.merchantID }],
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
