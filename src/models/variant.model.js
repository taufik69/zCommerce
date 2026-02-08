const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const purchaseModel = require("../models/purchase.model");
const { statusCodes } = require("../constant/constant");

const variantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: false,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    variantName: {
      type: String,
      required: false,
      trim: true,
    },

    sku: {
      type: String,
      trim: true,
    },

    //bar code
    qrCode: {
      type: String,
    },
    barCode: {
      type: String,
    },
    size: [
      {
        type: String,
        trim: true,

        default: "N/A",
      },
    ],
    color: [
      {
        type: String,
        trim: true,
        default: "N/A",
      },
    ],
    image: {
      type: String,
      trim: true,
      default: "N/A",
    },

    // Quantity / stock
    stockVariant: {
      type: Number,
      required: false,
      min: 0,
    },
    stockVariantAdjust: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "StockAdjust",
      },
    ],
    alertVariantStock: {
      type: Number,
      min: 0,
      default: 5,
    },
    // Pricing
    purchasePrice: {
      type: Number,
      required: false,
      min: 0,
    },
    retailPrice: {
      type: Number,
      required: false,
      min: 0,
    },
    retailProfitMarginbyPercentance: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    retailProfitMarginbyAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    wholesalePrice: {
      type: Number,
      min: 0,
    },
    wholesaleProfitMarginPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    wholesaleProfitMarginAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    alertQuantity: {
      type: Number,
      default: 5,
    },
    stockAlert: {
      type: Boolean,
      default: false,
    },
    instock: {
      type: Boolean,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    salesReturn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SalesReturn",
      },
    ],
    byReturn: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ByReturn",
      },
    ],
    courierReturn: {
      orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },
      variant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
        default: null,
      },
      recivedQuantity: {
        type: Number,
        default: 0,
      },
      courierName: {
        type: String,
        trim: true,
        default: "N/A",
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// calculate stock adjustment // adjustment plus
variantSchema.virtual("adjustmentMultipleVariantPlus").get(function () {
  return this.stockVariantAdjust?.reduce((total, variant) => {
    total += variant?.increaseQuantity;
    return total;
  }, 0);
});

//calculate stock adjustment // adjustment minus
variantSchema.virtual("adjustmentMultipleVariantMinus").get(function () {
  return this.stockVariantAdjust?.reduce((total, variant) => {
    total += variant?.decreaseQuantity;
    return total;
  }, 0);
});

// get opening stock
variantSchema.virtual("openingStock").get(function () {
  return (
    this.stockVariant +
    (this.adjustmentMultipleVariantMinus || 0) -
    (this.adjustmentMultipleVariantPlus || 0)
  );
});

// get multiVariantOpening stock
variantSchema.virtual("multiVariantOpeningStock").get(function () {
  return this.stockVariant;
});

// slugify
variantSchema.pre("save", function (next) {
  if (this.isModified("variantName")) {
    this.slug = slugify(this.variantName, { lower: true, strict: true });
  }
  next();
});

// findOneAndUpdate then change the slug
variantSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.variantName) {
    update.slug = slugify(update.variantName, { lower: true, strict: true });
  }
  next();
});

// get all byReturn quantity data
variantSchema.virtual("totalByReturnQuantity").get(function () {
  return this.byReturn?.reduce((total, item) => {
    total += item?.quantity;
    return total;
  }, 0);
});

// get all salesReturn quantity data
variantSchema.virtual("totalSalesReturnQuantity").get(function () {
  return this.salesReturn?.reduce((total, item) => {
    total += item?.quantity;
    return total;
  }, 0);
});

// Check for duplicate variant by size, color, product
variantSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({
      product: this.product,
      size: this.size,
      color: this.color,
      slug: this.slug,
    });

    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Variant with size ${this.size} and color ${this.color} already exists.`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

// check if slug already exist or not
variantSchema.pre("save", async function (next) {
  try {
    const existVariant = await this.constructor.findOne({ slug: this.slug });
    if (
      existVariant &&
      existVariant._id &&
      existVariant._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          ` ${this.variantName} already exists Try another`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// find purchase model and return total purchased quantity in
variantSchema.virtual("multipleVariantTotalPurchasedQuantity");

// Middleware: শুধুমাত্র find এর জন্য
variantSchema.post("find", async function (docs, next) {
  try {
    await Promise.all(
      docs.map(async (doc) => {
        const purchases = await purchaseModel.find({
          "allproduct.variant": doc._id,
        });

        let totalPurchased = 0;
        purchases.forEach((purchase) => {
          purchase.allproduct.forEach((item) => {
            if (
              item.variant &&
              item.variant.toString() === doc._id.toString()
            ) {
              totalPurchased += item.quantity || 0;
            }
          });
        });

        // Set the virtual property
        doc.multipleVariantTotalPurchasedQuantity = totalPurchased;
      }),
    );

    next();
  } catch (error) {
    next(error);
  }
});
module.exports =
  mongoose.models.Variant || mongoose.model("Variant", variantSchema);
