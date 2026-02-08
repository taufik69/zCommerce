const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

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
  try {
    const existingMerchant = await this.constructor.findOne({
      $or: [{ merchantID: this.merchantID }],
    });

    if (
      existingMerchant &&
      existingMerchant._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          "Merchant ID or slug already exists",
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
  mongoose.models.Merchant || mongoose.model("Merchant", merchantSchema);
