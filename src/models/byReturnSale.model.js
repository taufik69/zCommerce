const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");

const byReturnSchema = new mongoose.Schema(
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
    supplierName: {
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

    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// generate slug using productBarCode + supplierName
byReturnSchema.pre("save", function (next) {
  if (this.isModified("productBarCode") || this.isModified("supplierName")) {
    this.slug = slugify(`${this.productBarCode}-${this.supplierName}`, {
      lower: true,
      strict: true,
    });
  }
  next();
});

// check duplicate slug
byReturnSchema.pre("save", async function (next) {
  const existingByReturn = await this.constructor.findOne({
    slug: this.slug,
  });
  if (
    existingByReturn &&
    existingByReturn._id.toString() !== this._id.toString()
  ) {
    throw new customError(
      `ByReturn with slug ${this.slug} already exists`,
      400
    );
  }
  next();
});

module.exports =
  mongoose.models.ByReturn || mongoose.model("ByReturn", byReturnSchema);
