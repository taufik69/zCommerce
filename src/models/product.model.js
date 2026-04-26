const mongoose = require("mongoose");
const { default: slugify } = require("slugify");

// ─── Reusable subschemas ─────────────────────────────────────────────────────

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

const courierReturnSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
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
    receivedQuantity: { type: Number, default: 0 },
    courierName: { type: String, trim: true, default: "N/A" },
  },
  { _id: true, timestamps: true },
);

// SEO subdocument — search-engine + social-share metadata
const seoSchema = new mongoose.Schema(
  {
    metaTitle: { type: String, trim: true, maxlength: 70, default: "" },
    metaDescription: { type: String, trim: true, maxlength: 200, default: "" },
    metaKeywords: [{ type: String, trim: true, lowercase: true }],
    canonicalUrl: { type: String, trim: true, default: "" },
    focusKeyword: { type: String, trim: true, lowercase: true, default: "" },
    ogTitle: { type: String, trim: true, maxlength: 70, default: "" },
    ogDescription: { type: String, trim: true, maxlength: 200, default: "" },
    ogImage: { type: imageSchema, default: () => ({}) },
    twitterCard: {
      type: String,
      enum: ["summary", "summary_large_image", "app", "player"],
      default: "summary_large_image",
    },
    structuredData: { type: mongoose.Schema.Types.Mixed, default: null }, // JSON-LD
    noIndex: { type: Boolean, default: false },
    noFollow: { type: Boolean, default: false },
  },
  { _id: false },
);

// ─── Product schema ──────────────────────────────────────────────────────────

const productSchema = new mongoose.Schema(
  {
    slug: { type: String, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    subcategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      index: true,
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },
    variant: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],
    discount: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Discount",
      default: null,
    },

    // Media
    image: [imageSchema], // gallery
    thumbnail: { type: imageSchema, default: () => ({}) },

    // SEO
    seo: { type: seoSchema, default: () => ({}) },

    // Tags / metadata
    tag: [{ type: String, trim: true, lowercase: true }],
    manufactureCountry: { type: String, trim: true },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    warrantyInformation: { type: String, default: "No warranty info" },
    shippingInformation: {
      type: String,
      default: "Shipping details not available",
    },

    weight: { type: Number, default: 0, min: 0 },
    dimensions: {
      width: { type: Number, default: 0, min: 0 },
      height: { type: Number, default: 0, min: 0 },
      depth: { type: Number, default: 0, min: 0 },
    },

    availabilityStatus: {
      type: String,
      enum: ["In Stock", "Out of Stock", "Preorder"],
      default: "In Stock",
    },

    // Identifiers
    sku: { type: String, trim: true, unique: true, sparse: true, index: true },
    qrCode: { type: String },
    barCode: { type: String, unique: true, sparse: true, index: true },

    // Units
    groupUnit: { type: String },
    groupUnitQuantity: { type: Number },
    unit: {
      type: String,
      enum: ["Piece", "Kg", "Gram", "Packet", "Custom"],
    },

    // Variant type
    variantType: {
      type: String,
      enum: ["singleVariant", "multipleVariant"],
      required: true,
    },

    // Single-variant inventory
    size: { type: String, trim: true, default: "N/A" },
    color: { type: String, trim: true, default: "N/A" },
    stock: { type: Number, min: 0, default: 0 },
    warehouseLocation: { type: String, trim: true },

    // Pricing
    purchasePrice: { type: Number, min: 0 },
    retailPrice: { type: Number, min: 0 },
    retailProfitMarginByPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    wholesalePrice: { type: Number, min: 0 },
    wholesaleProfitMarginPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    alertQuantity: { type: Number, default: 5 },
    stockAlert: { type: Boolean, default: false },
    instock: { type: Boolean },
    stockAdjustment: [
      { type: mongoose.Schema.Types.ObjectId, ref: "StockAdjust" },
    ],
    isActive: { type: Boolean, default: true, index: true },
    totalSales: { type: Number, default: 0 },
    salesReturn: [{ type: mongoose.Schema.Types.ObjectId, ref: "SalesReturn" }],
    byReturn: [{ type: mongoose.Schema.Types.ObjectId, ref: "ByReturn" }],
    courierReturn: [courierReturnSchema],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

productSchema.index({
  name: "text",
  "seo.metaKeywords": "text",
  "seo.focusKeyword": "text",
});
productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ totalSales: -1 });
productSchema.index({ retailPrice: 1 });

// ─── Hooks ────────────────────────────────────────────────────────────────────

// Auto-slug on save
productSchema.pre("save", function (next) {
  if (this.isModified("name") && !this.isModified("slug")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Auto-slug on findOneAndUpdate
productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update?.name && !update.slug) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

// ─── Virtuals ─────────────────────────────────────────────────────────────────

productSchema.virtual("retailProfitMarginByAmount").get(function () {
  return (this.retailPrice || 0) - (this.purchasePrice || 0);
});

productSchema.virtual("wholesaleProfitMarginByAmount").get(function () {
  return (this.wholesalePrice || 0) - (this.purchasePrice || 0);
});

productSchema.virtual("singleVariantOpeningStock").get(function () {
  return this.stock;
});

productSchema.virtual("adjustmentSingleVariantPlus").get(function () {
  return (this.stockAdjustment || []).reduce(
    (sum, a) => sum + (a?.increaseQuantity || 0),
    0,
  );
});

productSchema.virtual("adjustmentSingleVariantMinus").get(function () {
  return (this.stockAdjustment || []).reduce(
    (sum, a) => sum + (a?.decreaseQuantity || 0),
    0,
  );
});

productSchema.virtual("totalByReturnQuantity").get(function () {
  return (this.byReturn || []).reduce(
    (sum, item) => sum + (item?.quantity || 0),
    0,
  );
});

productSchema.virtual("totalSalesReturnQuantity").get(function () {
  return (this.salesReturn || []).reduce(
    (sum, item) => sum + (item?.quantity || 0),
    0,
  );
});

productSchema.virtual("sizeWiseStock").get(function () {
  const result = {};

  if (this.variant?.length > 0) {
    this.variant.forEach((v) => {
      if (v?.size) {
        result[v.size] = (result[v.size] || 0) + (v.stockVariant || 0);
      }
    });
    return result;
  }

  if (this.variantType === "singleVariant" && this.size) {
    result[this.size] = (result[this.size] || 0) + (this.stock || 0);
  }
  return result;
});

// NOTE: The previous `post('find')` middleware that fetched purchase totals on
// EVERY find() call has been REMOVED — it caused N+1 queries on every list/get
// request. To compute purchase totals, use a dedicated endpoint or aggregation
// only when explicitly needed.

const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
module.exports = Product;
