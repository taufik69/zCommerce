const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

const salesReturnSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
    },
    productBarCode: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
    cashReturnMode: {
      type: String,
      enum: ["cash", "bank", "mobile_banking"],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// make a slug using name
salesReturnSchema.pre("save", function (next) {
  if (this.isModified("productBarCode")) {
    this.slug = slugify(this.productBarCode, { lower: true, strict: true });
  }
  next();
});

// check if slug already exist or not
salesReturnSchema.pre("save", async function (next) {
  const existingSalesReturn = await this.constructor.findOne({
    slug: this.slug,
  });
  if (
    existingSalesReturn &&
    existingSalesReturn._id.toString() !== this._id.toString()
  ) {
    console.log(
      `SalesReturn with slug ${this.slug} or productBarCode ${this.productBarCode} already exists`
    );
    throw new customError(
      `SalesReturn with slug ${this.slug} or productBarCode ${this.productBarCode} already exists`,
      400
    );
  }
  next();
});

module.exports = mongoose.model("SalesReturn", salesReturnSchema);
