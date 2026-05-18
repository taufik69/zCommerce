# zCommerce v2 — Full Architecture Design

> Role: Senior Software Architect & Database Designer (10 years experience)  
> Date: 2026-04-20 | Stack: Node.js + Express + MongoDB + Mongoose

---

## TABLE OF CONTENTS

1. [Model Status Overview](#1-model-status-overview)
2. [Database Relationship Map](#2-database-relationship-map)
3. [Shared Subdocuments](#3-shared-subdocuments)
4. [Core Catalog Models](#4-core-catalog-models) — Category, Brand, AttributeDefinition, SizeChart, Product+Variant
5. [Promotions & Pricing Models](#5-promotions--pricing-models) — Discount, FlashSale, Coupon, Banner
6. [Auth & RBAC Models](#6-auth--rbac-models) — Permission, Role, User, Middlewares
7. [Commerce Models (minor updates)](#7-commerce-models-minor-updates) — Cart, Order, Purchase, Sales
8. [Unchanged Models](#8-unchanged-models)
9. [API Endpoints List](#9-api-endpoints-list)
10. [Database Indexes](#10-database-indexes)
11. [Design Decisions Summary](#11-design-decisions-summary)

---

## 1. Model Status Overview

### REMOVED (2)

| Model                    | Reason                                                      |
| ------------------------ | ----------------------------------------------------------- |
| `subcategory.model.js`   | Replaced by self-referential Category (parent: null = root) |
| `userPermisson.model.js` | Redundant — permissions live on User directly + via Roles   |

### MAJOR REDESIGN (5)

| Model                | What Changed                                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `category.model.js`  | Self-referential parent ref, removes subcategories array                                                                                     |
| `product.model.js`   | Variants embedded (not ref), dynamic attributes, sizeChart ref, discount ref                                                                 |
| `variant.model.js`   | **Becomes embedded subdocument inside Product** — no longer a separate collection                                                            |
| `sizeChart.model.js` | Template-based data table (columns + rows), not just an image                                                                                |
| `discount.model.js`  | **PRODUCTION-GRADE**: Multi-level scope, advanced conditions, usage tracking, customer targeting, geographic restrictions, atomic operations |

### NEW MODELS (3)

| Model                          | Purpose                                                           |
| ------------------------------ | ----------------------------------------------------------------- |
| `flashSale.model.js`           | Time-limited sale with per-item stock cap and countdown           |
| `attributeDefinition.model.js` | Admin-defined attribute types (Color, Size, Material, Storage...) |
| `banner.model.js`              | Merged `banner` + `discountBanner` into one with `type` field     |

### MINOR UPDATES (5)

| Model               | What Changed                                                         |
| ------------------- | -------------------------------------------------------------------- |
| `role.model.js`     | Added `permissions[]` array                                          |
| `user.model.js`     | Cleaner RBAC, `isSuperAdmin` flag, structured address                |
| `cart.model.js`     | `variantId` replaces old Variant ObjectId, add `attributes` snapshot |
| `order.model.js`    | Items array now has `variantId` + attribute snapshot                 |
| `purchase.model.js` | Line items use `variantId` + attribute snapshot                      |

### UNCHANGED MODELS (22)

`sales`, `salesReturn`, `byReturnSale`, `coupon`, `customer`, `supplier`,
`employee`, `advancePayment` (Designation/Department/Section/EmployeeAdvance),
`stockAdjust`, `account`, `moneyTransfer`, `crateTransaction`, `fundHandover`,
`transitionCategory`, `counter`, `delivery`, `invoice`, `merchant`,
`siteInformation`, `outletInformation`, `wishList`

---

## 2. Database Relationship Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AUTH & RBAC                                  │
│  User ──has many──► Role ──has many──► Permission                   │
│  User ──direct──► Permission (override: grant|deny)                 │
│  User.isSuperAdmin = true → bypasses all checks                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        CATALOG                                      │
│  Category (self-ref: parent=null means root)                        │
│    └── Category (level 2)                                           │
│         └── Category (level 3)  ...unlimited depth                 │
│                                                                     │
│  Brand (independent — not tied to Category)                         │
│                                                                     │
│  AttributeDefinition  ←  admin defines "Color", "Size", etc.       │
│                                                                     │
│  Product ──ref──► Category                                          │
│           ──ref──► Brand (optional)                                 │
│           ──ref──► SizeChart (optional, inherits from Category)     │
│           ──embeds──► Variant[]                                     │
│                        ├── attributes: [{key,value}] (dynamic)      │
│                        ├── images: [imageSchema]                    │
│                        ├── pricing: {purchase,retail,wholesale}     │
│                        └── stock: {qty, alert, location}            │
│           ──embeds──► images[] (product gallery)                   │
│           ──embeds──► reviews[]                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    PROMOTIONS (Priority cascade)                    │
│  FlashSale ──targets──► Product.variantId        (highest priority) │
│  Discount  ──targets──► Variant[] | Product[]                       │
│                       | Brand[]   | Category[]   (mid priority)     │
│                       | all                                         │
│  Coupon    ──applied at checkout──► Order        (lowest priority)  │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        COMMERCE                                     │
│  Cart    ──ref──► Product + variantId (embedded _id)                │
│  Order   ──ref──► User | guestId                                    │
│           ──embeds──► items (product+variantId snapshot)            │
│  Purchase──ref──► Supplier                                          │
│           ──embeds──► line items (product+variantId+attr snapshot)  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Shared Subdocuments

```js
// src/models/schemas/image.schema.js
const { Schema } = require("mongoose");

const imageSchema = new Schema(
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
  { _id: true },
);

module.exports = imageSchema;
```

---

## 4. Core Catalog Models

### 4.1 Category Model

```js
// src/models/category.model.js
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const imageSchema = require("./schemas/image.schema");
const { Schema } = mongoose;

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    // null = root category | ObjectId = child category
    parent: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    image: imageSchema,
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Virtual: fetch direct children via populate
categorySchema.virtual("children", {
  ref: "Category",
  localField: "_id",
  foreignField: "parent",
});

// Auto-slug with collision handling
categorySchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("name")) {
    let base = slugify(this.name, { lower: true, strict: true });
    let slug = base,
      i = 1;
    while (
      await mongoose.model("Category").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }
  next();
});

categorySchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

// Prevent deleting a category that has children
categorySchema.pre(
  "deleteOne",
  { document: true, query: false },
  async function (next) {
    const hasChildren = await mongoose
      .model("Category")
      .exists({ parent: this._id });
    if (hasChildren) {
      return next(
        new customError(
          "Cannot delete category with sub-categories",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  },
);

module.exports =
  mongoose.models.Category || mongoose.model("Category", categorySchema);
```

**Key: Getting the full tree**

```js
// Service layer — recursive tree build
async function getCategoryTree(parentId = null) {
  const categories = await Category.find({
    parent: parentId,
    isActive: true,
  }).lean();
  for (const cat of categories) {
    cat.children = await getCategoryTree(cat._id);
  }
  return categories;
}

// OR use $graphLookup for large trees (single query)
Category.aggregate([
  { $match: { parent: null } },
  {
    $graphLookup: {
      from: "categories",
      startWith: "$_id",
      connectFromField: "_id",
      connectToField: "parent",
      as: "descendants",
      maxDepth: 5,
    },
  },
]);
```

---

### 4.2 Brand Model

```js
// src/models/brand.model.js
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const imageSchema = require("./schemas/image.schema");
const { Schema } = mongoose;

const brandSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true },
    logo: { type: imageSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

brandSchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("name")) {
    let base = slugify(this.name, { lower: true, strict: true });
    let slug = base,
      i = 1;
    while (
      await mongoose.model("Brand").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }
  next();
});

brandSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

module.exports = mongoose.models.Brand || mongoose.model("Brand", brandSchema);
```

---

### 4.3 AttributeDefinition Model

```js
// src/models/attributeDefinition.model.js
// Admin defines available attributes. Variants use free key-value,
// but this model drives the UI (dropdowns, color pickers, etc.)
const mongoose = require("mongoose");
const slugify = require("slugify");
const { Schema } = mongoose;

const attributeDefinitionSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // "Color", "Size", "Storage"
    slug: { type: String, unique: true, lowercase: true, trim: true },
    // How the admin UI renders this attribute
    inputType: {
      type: String,
      enum: ["text", "color", "select", "multiselect", "number", "boolean"],
      default: "select",
    },
    // Predefined option values (editable by admin)
    values: { type: [String], default: [] }, // ["Red","Blue","Green"] or ["S","M","L","XL"]
    unit: { type: String, default: "" }, // "inch", "GB", "cm"
    // UX flags
    isFilterable: { type: Boolean, default: true }, // show as product filter on storefront
    isVisibleOnPDP: { type: Boolean, default: true }, // show on product detail page
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

attributeDefinitionSchema.pre("save", function (next) {
  if (!this.slug || this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.AttributeDefinition ||
  mongoose.model("AttributeDefinition", attributeDefinitionSchema);
```

---

### 4.4 SizeChart Model (Template-Based Data Table)

const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// ═════════════════════════════════════════════════════════════════════════════════
// ── COLUMN SCHEMA (Dynamic measurement columns) ──────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════
const columnSchema = new mongoose.Schema(
{
key: {
type: String,
required: [true, "Column key is required"],
trim: true,
lowercase: true,
match: [/^[a-z0-9_]+$/, "Column key can only contain lowercase letters, numbers, and underscores"],
},
label: {
type: String,
required: [true, "Column label is required"],
trim: true,
},
unit: {
type: String,
enum: ["inch", "cm", "mm", "kg", "lbs", "ml", "l"],
default: "cm",
},
order: {
type: Number,
default: 0,
},
description: {
type: String,
trim: true,
},
},
{ \_id: false },
);

// ═════════════════════════════════════════════════════════════════════════════════
// ── ROW SCHEMA (Size options with measurements) ─────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════
const rowSchema = new mongoose.Schema(
{
label: {
type: String,
required: [true, "Row label (size) is required"],
trim: true,
uppercase: true,
},
values: {
type: [String],
required: [true, "Values are required"],
validate: {
validator: function (values) {
return values.length > 0 && values.every((v) => v && v.trim());
},
message: "All values must be non-empty strings",
},
},
order: {
type: Number,
default: 0,
},
sku: {
type: String,
trim: true,
},
},
{ \_id: false },
);

// ═════════════════════════════════════════════════════════════════════════════════
// ── CONVERSION RULE SCHEMA (For unit conversion support) ────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════
const conversionRuleSchema = new mongoose.Schema(
{
fromUnit: {
type: String,
enum: ["inch", "cm", "mm", "kg", "lbs", "ml", "l"],
required: true,
},
toUnit: {
type: String,
enum: ["inch", "cm", "mm", "kg", "lbs", "ml", "l"],
required: true,
},
factor: {
type: Number,
required: true,
min: 0,
},
},
{ \_id: false },
);

// ═════════════════════════════════════════════════════════════════════════════════
// ── MAIN SIZE CHART SCHEMA ──────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════
const sizeChartSchema = new mongoose.Schema(
{
// ── BASIC INFORMATION ───────────────────────────────────────────────────────
name: {
type: String,
required: [true, "Size chart name is required"],
trim: true,
maxlength: [100, "Name cannot exceed 100 characters"],
},
slug: {
type: String,
unique: true,
lowercase: true,
trim: true,
index: true,
},
description: {
type: String,
trim: true,
maxlength: [500, "Description cannot exceed 500 characters"],
},
category: {
type: String,
required: [true, "Category is required (e.g., 'apparel', 'shoes', 'accessories')"],
trim: true,
lowercase: true,
index: true,
},

    // ── HIERARCHICAL TARGETING (Can be used at multiple levels) ────────────────
    applicableLevel: {
      type: String,
      enum: ["category", "subCategory", "product", "variant"],
      required: [true, "Applicable level is required"],
      index: true,
    },

    // Apply at these specific entities (one or more based on level)
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
        index: true,
      },
    ],
    applicableSubCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
        index: true,
      },
    ],
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        index: true,
      },
    ],
    applicableVariants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
        index: true,
      },
    ],

    // ── TABLE STRUCTURE ─────────────────────────────────────────────────────────
    columns: {
      type: [columnSchema],
      required: [true, "At least one column is required"],
      validate: {
        validator: function (columns) {
          return columns.length > 0 && columns.length <= 10;
        },
        message: "Size chart must have 1-10 columns",
      },
    },
    rows: {
      type: [rowSchema],
      required: [true, "At least one row (size) is required"],
      validate: {
        validator: function (rows) {
          const firstColumnCount = this.columns[0]?.label ? 1 : 0;
          if (firstColumnCount === 0) return true;
          return rows.every((row) => row.values.length === this.columns.length);
        },
        message: "All rows must have same number of values as columns",
      },
    },

    // ── MEASUREMENT GUIDE & HELP ────────────────────────────────────────────────
    measurementGuide: {
      type: String,
      trim: true,
      maxlength: [1000, "Measurement guide cannot exceed 1000 characters"],
    },
    tips: [
      {
        title: String,
        description: String,
      },
    ],
    videoUrl: {
      type: String,
      match: [
        /^https?:\/\/.+/,
        "Video URL must be a valid HTTP/HTTPS URL",
      ],
    },

    // ── UNIT CONVERSION (Optional: support multiple units) ──────────────────────
    supportedUnits: [
      {
        type: String,
        enum: ["inch", "cm", "mm", "kg", "lbs", "ml", "l"],
      },
    ],
    conversionRules: [conversionRuleSchema],

    // ── DISPLAY & VISIBILITY ───────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    visibility: {
      type: String,
      enum: ["public", "internal", "draft"],
      default: "public",
      index: true,
    },

    // ── COMPARISON SETTINGS (For showing multiple size charts) ──────────────────
    parentChartId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SizeChart",
      default: null,
    },
    isTemplateChart: {
      type: Boolean,
      default: false,
      // Template charts can be inherited by child products
    },
    childCharts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SizeChart",
      },
    ],

    // ── SIZE RANGES (For filtering/search support) ──────────────────────────────
    sizeLabels: [
      {
        type: String,
        // Auto-populated from rows.label for easy filtering
      },
    ],
    minSize: String,
    maxSize: String,

    // ── ADMIN & TRACKING ────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    viewCount: {
      type: Number,
      default: 0,
    },
    usageCount: {
      type: Number,
      default: 0,
      // How many products/variants use this chart
    },

},
{
timestamps: true,
},
);

// ═════════════════════════════════════════════════════════════════════════════════
// ── INDEXES FOR PERFORMANCE ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════
sizeChartSchema.index({ slug: 1 });
sizeChartSchema.index({ isActive: 1, visibility: 1 });
sizeChartSchema.index({ category: 1, applicableLevel: 1 });
sizeChartSchema.index({ applicableCategories: 1 });
sizeChartSchema.index({ applicableSubCategories: 1 });
sizeChartSchema.index({ applicableProducts: 1 });
sizeChartSchema.index({ applicableVariants: 1 });
sizeChartSchema.index({ parentChartId: 1, isTemplateChart: 1 });
sizeChartSchema.index({ createdAt: -1, updatedAt: -1 });

// ═════════════════════════════════════════════════════════════════════════════════
// ── PRE-SAVE VALIDATIONS ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════

// Generate slug from name
sizeChartSchema.pre("save", function (next) {
if (this.isModified("name")) {
this.slug = slugify(this.name, { lower: true, strict: true });
}
next();
});

// Validate columns and rows alignment
sizeChartSchema.pre("save", function (next) {
if (this.columns && this.rows) {
const columnCount = this.columns.length;
const rowValuesValid = this.rows.every((row) => row.values.length === columnCount);

    if (!rowValuesValid) {
      return next(
        new customError(
          `All rows must have exactly ${columnCount} values to match columns`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }

}
next();
});

// Auto-populate sizeLabels from rows
sizeChartSchema.pre("save", function (next) {
if (this.rows && this.rows.length > 0) {
this.sizeLabels = this.rows
.sort((a, b) => a.order - b.order)
.map((row) => row.label);

    // Set min and max
    if (this.sizeLabels.length > 0) {
      this.minSize = this.sizeLabels[0];
      this.maxSize = this.sizeLabels[this.sizeLabels.length - 1];
    }

}
next();
});

// Sort columns and rows by order
sizeChartSchema.pre("save", function (next) {
if (this.columns && this.columns.length > 0) {
this.columns.sort((a, b) => a.order - b.order);
}
if (this.rows && this.rows.length > 0) {
this.rows.sort((a, b) => a.order - b.order);
}
next();
});

// Validate applicable level has corresponding entities
sizeChartSchema.pre("save", function (next) {
const levelMap = {
category: "applicableCategories",
subCategory: "applicableSubCategories",
product: "applicableProducts",
variant: "applicableVariants",
};

const applicableField = levelMap[this.applicableLevel];
const applicable = this[applicableField];

if (!this.isTemplateChart && (!applicable || applicable.length === 0)) {
return next(
new customError(
`${this.applicableLevel} requires at least one applicable entity`,
statusCodes.BAD_REQUEST,
),
);
}

next();
});

// Check for duplicate slug
sizeChartSchema.pre("save", async function (next) {
try {
if (this.isModified("slug") || !this.slug) {
const existingChart = await this.constructor.findOne({ slug: this.slug });
if (
existingChart &&
existingChart.\_id.toString() !== this.\_id.toString()
) {
return next(
new customError(
`Size chart "${this.name}" already exists`,
statusCodes.BAD_REQUEST,
),
);
}
}
next();
} catch (error) {
next(error);
}
});

// ═════════════════════════════════════════════════════════════════════════════════
// ── INSTANCE METHODS ────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════

/\*\*

- Get size chart as formatted HTML table
  \*/
  sizeChartSchema.methods.getTableHTML = function () {
  if (!this.columns || !this.rows) {
  return "<p>No size chart available</p>";
  }

let html = '<table class="size-chart-table">';

// Header
html += "<thead><tr>";
html += "<th>Size</th>";
this.columns.forEach((col) => {
html += `<th>${col.label} (${col.unit})</th>`;
});
html += "</tr></thead>";

// Body
html += "<tbody>";
this.rows.forEach((row) => {
html += "<tr>";
html += `<td><strong>${row.label}</strong></td>`;
row.values.forEach((val) => {
html += `<td>${val}</td>`;
});
html += "</tr>";
});
html += "</tbody></table>";

return html;
};

/\*\*

- Get a specific size's measurements
  \*/
  sizeChartSchema.methods.getSizeMeasurements = function (sizeLabel) {
  const row = this.rows.find((r) => r.label.toUpperCase() === sizeLabel.toUpperCase());
  if (!row) return null;

const measurements = {};
this.columns.forEach((col, index) => {
measurements[col.key] = {
value: row.values[index],
unit: col.unit,
label: col.label,
};
});

return measurements;
};

/\*\*

- Check if size is available in this chart
  \*/
  sizeChartSchema.methods.hasSizeLabel = function (sizeLabel) {
  return this.sizeLabels.includes(sizeLabel.toUpperCase());
  };

/\*\*

- Get column by key
  \*/
  sizeChartSchema.methods.getColumn = function (key) {
  return this.columns.find((col) => col.key === key.toLowerCase());
  };

/\*\*

- Convert value between units
  \*/
  sizeChartSchema.methods.convertUnit = function (value, fromUnit, toUnit) {
  if (fromUnit === toUnit) return parseFloat(value);

const rule = this.conversionRules.find(
(r) => r.fromUnit === fromUnit && r.toUnit === toUnit,
);

if (!rule) {
throw new customError(
`Conversion from ${fromUnit} to ${toUnit} not supported`,
statusCodes.BAD_REQUEST,
);
}

return parseFloat(value) \* rule.factor;
};

/\*\*

- Increment view count (when chart is displayed to customer)
  \*/
  sizeChartSchema.methods.incrementViewCount = async function () {
  return await this.constructor.findByIdAndUpdate(
  this.\_id,
  { $inc: { viewCount: 1 } },
  { new: true },
  );
  };

/\*\*

- Increment usage count (when product/variant uses this chart)
  \*/
  sizeChartSchema.methods.incrementUsageCount = async function () {
  return await this.constructor.findByIdAndUpdate(
  this.\_id,
  { $inc: { usageCount: 1 } },
  { new: true },
  );
  };

// ═════════════════════════════════════════════════════════════════════════════════
// ── STATIC METHODS ──────────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════════

/\*\*

- Get applicable charts for a product/variant
  \*/
  sizeChartSchema.statics.getApplicableCharts = async function (filters = {}) {
  try {
  const query = {
  isActive: true,
  visibility: "public",
  };

      // Filter by level
      if (filters.level) {
        query.applicableLevel = filters.level;
      }

      // Filter by product
      if (filters.productId) {
        query.$or = [
          { applicableProducts: filters.productId },
          { applicableLevel: "category", category: filters.category },
        ];
      }

      // Filter by variant
      if (filters.variantId) {
        query.applicableVariants = filters.variantId;
      }

      // Filter by category
      if (filters.categoryId) {
        query.$or = query.$or || [];
        query.$or.push({
          applicableLevel: "category",
          applicableCategories: filters.categoryId,
        });
      }

      // Filter by category name
      if (filters.category) {
        query.category = filters.category.toLowerCase();
      }

      return await this.find(query)
        .sort({ displayOrder: 1 })
        .lean();

  } catch (error) {
  throw error;
  }
  };

/\*\*

- Create from template
  \*/
  sizeChartSchema.statics.createFromTemplate = async function (templateId, data) {
  try {
  const template = await this.findById(templateId);
  if (!template || !template.isTemplateChart) {
  throw new customError(
  "Template not found or is not a valid template",
  statusCodes.NOT_FOUND,
  );
  }

      const newChart = new this({
        ...data,
        columns: template.columns,
        rows: template.rows,
        conversionRules: template.conversionRules,
        supportedUnits: template.supportedUnits,
        parentChartId: templateId,
      });

      await newChart.save();
      return newChart;

  } catch (error) {
  throw error;
  }
  };

// ═════════════════════════════════════════════════════════════════════════════════

module.exports =
mongoose.models.SizeChart || mongoose.model("SizeChart", sizeChartSchema);

```js
// src/models/sizeChart.model.js
// Template-based. Admin creates reusable size guides (data table, not image).
// Category or Product can reference a template.
// Product can override with its own sizeChartId.
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const { Schema } = mongoose;

// Each column header
const columnSchema = new Schema(
  {
    key: { type: String, required: true, trim: true }, // "chest"
    label: { type: String, required: true, trim: true }, // "Chest"
    unit: { type: String, default: "" }, // "inch" | "cm"
  },
  { _id: false },
);

// Each row in the table (one row = one size)
const rowSchema = new Schema(
  {
    label: { type: String, required: true, trim: true }, // "S", "M", "38", "EU 42"
    values: { type: [String], default: [] },
    // values index matches columns index
    // e.g. columns = [{key:"chest"}, {key:"waist"}]
    //      row.values = ["36", "30"]
  },
  { _id: false },
);

const sizeChartSchema = new Schema(
  {
    name: { type: String, required: true, trim: true }, // "T-Shirt International Size Guide"
    slug: { type: String, unique: true, lowercase: true, trim: true },

    // Scope: link to a category (optional). null = global template usable anywhere.
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },
    brand: { type: Schema.Types.ObjectId, ref: "Brand", default: null },

    // The actual table data
    columns: { type: [columnSchema], default: [] },
    rows: { type: [rowSchema], default: [] },

    // Optional: measurement instructions shown to customer
    measurementGuide: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sizeChartSchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("name")) {
    let base = slugify(this.name, { lower: true, strict: true });
    let slug = base,
      i = 1;
    while (
      await mongoose.model("SizeChart").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }
  next();
});

module.exports =
  mongoose.models.SizeChart || mongoose.model("SizeChart", sizeChartSchema);
```

**Example data:**

```json
{
  "name": "Men's T-Shirt Size Guide",
  "category": "ObjectId(shirts)",
  "columns": [
    { "key": "chest", "label": "Chest", "unit": "inch" },
    { "key": "waist", "label": "Waist", "unit": "inch" },
    { "key": "length", "label": "Length", "unit": "inch" }
  ],
  "rows": [
    { "label": "S", "values": ["36", "30", "27"] },
    { "label": "M", "values": ["38", "32", "28"] },
    { "label": "L", "values": ["40", "34", "29"] },
    { "label": "XL", "values": ["42", "36", "30"] },
    { "label": "XXL", "values": ["44", "38", "31"] }
  ],
  "measurementGuide": "Measure your chest at the widest point. Keep tape slightly loose."
}
```

---

### 4.5 Product Model (with Embedded Variants)

```js
// src/models/product.model.js
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const imageSchema = require("./schemas/image.schema");
const { Schema } = mongoose;

// ── Dynamic Attribute (per variant) ───────────────────────────────────────
// key = attribute name from AttributeDefinition (e.g. "Color")
// value = chosen value (e.g. "Red")  — Mixed allows string|number|boolean
const attributeSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { _id: false },
);

// ── Pricing (per variant) ─────────────────────────────────────────────────
const pricingSchema = new Schema(
  {
    purchasePrice: { type: Number, default: 0, min: 0 },
    // retailPrice = আমাদের selling price (storefront-এ এটাই দেখায়)
    // MRP / compareAtPrice দেখাতে চাইলে: retailPrice-এর চেয়ে বড় value assign করো
    // যেমন: MRP=2000, retailPrice=1500 → storefront "৳2000 → ৳1500 (25% off)" দেখাবে
    retailPrice: { type: Number, default: 0, min: 0 },
    wholesalePrice: { type: Number, default: 0, min: 0 },
    // Computed profit margins — set on save by service layer
    retailProfitAmount: { type: Number, default: 0, min: 0 },
    retailProfitPercent: { type: Number, default: 0, min: 0, max: 100 },
    wholesaleProfitAmount: { type: Number, default: 0, min: 0 },
    wholesaleProfitPercent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { _id: false },
);

// ── Stock (per variant) ────────────────────────────────────────────────────
const stockSchema = new Schema(
  {
    quantity: { type: Number, default: 0, min: 0 },
    alertThreshold: { type: Number, default: 5, min: 0 },
    warehouseLocation: { type: String, default: "", trim: true },
  },
  { _id: false },
);

// ── Variant (embedded in Product) ─────────────────────────────────────────
// NOTE: variants are embedded subdocuments, NOT a separate collection.
// Reference a specific variant by: product._id + variant._id
const variantSchema = new Schema(
  {
    sku: { type: String, trim: true }, // unique per product, checked at app layer
    barCode: { type: String, trim: true, default: "" },
    qrCode: { type: String, default: "" },
    variantName: { type: String, trim: true, default: "" }, // auto-built label e.g. "Red / XL"
    attributes: { type: [attributeSchema], default: [] }, // [{ key:"Color", value:"Red" }, { key:"Size", value:"XL" }]
    images: { type: [imageSchema], default: [] }, // variant-specific photos
    pricing: { type: pricingSchema, default: () => ({}) },
    stock: { type: stockSchema, default: () => ({}) },

    // ── Shipping measurements (per variant) ───────────────────────────────
    // Courier API (Pathao, Steadfast, RedX) এর জন্য required
    // একই product-এর ভিন্ন variant-এর weight আলাদা হতে পারে
    // (e.g. 128GB vs 512GB same weight, কিন্তু packaging size আলাদা হতে পারে)
    weight: {
      value: { type: Number, default: 0, min: 0 },
      unit: { type: String, enum: ["g", "kg"], default: "g" },
    },
    dimensions: {
      length: { type: Number, default: 0, min: 0 },
      width: { type: Number, default: 0, min: 0 },
      height: { type: Number, default: 0, min: 0 },
      unit: { type: String, enum: ["cm", "inch"], default: "cm" },
    },

    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    totalSales: { type: Number, default: 0 },
    // Returns tracking (refs to return documents)
    salesReturn: [{ type: Schema.Types.ObjectId, ref: "SalesReturn" }],
    byReturn: [{ type: Schema.Types.ObjectId, ref: "ByReturn" }],
  },
  { _id: true, timestamps: true },
);

variantSchema.virtual("inStock").get(function () {
  return this.stock.quantity > 0;
});
variantSchema.virtual("lowStock").get(function () {
  return (
    this.stock.quantity > 0 && this.stock.quantity <= this.stock.alertThreshold
  );
});

// ── Review — SEPARATE COLLECTION (Product-এ embedded নয়) ─────────────────
// কারণ:
//  1. Product listing query-তে সব reviews load হতো — memory waste
//  2. Embedded হলে pagination অসম্ভব ("Load more reviews" কাজ করে না)
//  3. প্রতিটা review-এ images আছে — 500+ review-এ 16MB document limit risk
//  4. avgRating recalculate করতে পুরো product save করতে হতো
// এখন: Product-এ শুধু avgRating + totalReviews (denormalized counter) রাখো
// Review add/delete হলে background-এ counter update করো
const reviewSchema = new Schema(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, default: "", trim: true },
    images: { type: [imageSchema], default: [] },
    isActive: { type: Boolean, default: true, index: true },

    // Moderation workflow — admin approve/reject করতে পারে
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    // verified purchase badge — order history থেকে check করে set করা হয়
    isVerifiedPurchase: { type: Boolean, default: false },
  },
  { _id: true, timestamps: true },
);

// একজন user একটা product-এ একটাই review দিতে পারবে
reviewSchema.index({ product: 1, user: 1 }, { unique: true });

module.exports =
  mongoose.models.Review || mongoose.model("Review", reviewSchema);
// ─────────────────────────────────────────────────────────────────────────────
// NOTE: Review model আলাদা file-এ রাখো: src/models/review.model.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Product ────────────────────────────────────────────────────────────────
const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    description: { type: String, default: "", trim: true },

    // Catalog references
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: "Brand",
      default: null,
      index: true,
    },

    // Size chart: use product-level override OR inherit from category at API layer
    sizeChart: { type: Schema.Types.ObjectId, ref: "SizeChart", default: null },

    // Active discount (populated by discount engine, not set directly)
    // Promotions are resolved at query time — DO NOT store discount price here
    // Flash sale items reference product+variantId directly

    tags: { type: [String], default: [] },
    images: { type: [imageSchema], default: [] }, // product-level gallery

    // Embedded collections
    variants: { type: [variantSchema], default: [] },
    reviews: { type: [reviewSchema], default: [] },

    // Shared product-level info
    unit: {
      type: String,
      enum: ["Piece", "Kg", "Gram", "Packet", "Litre", "Custom"],
      default: "Piece",
    },
    groupUnit: { type: String, default: "" },
    groupUnitQuantity: { type: Number, default: 0, min: 0 },
    warrantyInformation: { type: String, default: "" },
    shippingInformation: { type: String, default: "" },
    manufactureCountry: { type: String, default: "" },

    // SEO
    metaTitle: { type: String, default: "" },
    metaDescription: { type: String, default: "" },

    // Denormalized stats (updated by background jobs or on sale/return)
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    totalSales: { type: Number, default: 0, min: 0 },

    // Soft delete
    isActive: { type: Boolean, default: true, index: true },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ────────────────────────────────────────────────────────────────
productSchema.index({
  name: "text",
  "variants.sku": "text",
  "variants.barCode": "text",
});
productSchema.index({ category: 1, brand: 1, isActive: 1 });
productSchema.index({ totalSales: -1 });
productSchema.index({ createdAt: -1 });
productSchema.index({ "variants.sku": 1 });
productSchema.index({ "variants.barCode": 1 });
productSchema.index({ isDeleted: 1, isActive: 1 });

// ── Virtuals ───────────────────────────────────────────────────────────────
productSchema.virtual("activeVariants").get(function () {
  return this.variants.filter((v) => v.isActive);
});
productSchema.virtual("inStock").get(function () {
  return this.variants.some((v) => v.isActive && v.stock.quantity > 0);
});
productSchema.virtual("totalStock").get(function () {
  return this.variants.reduce((acc, v) => acc + (v.stock.quantity || 0), 0);
});
productSchema.virtual("minRetailPrice").get(function () {
  const prices = this.variants
    .filter((v) => v.isActive)
    .map((v) => v.pricing.retailPrice || 0);
  return prices.length ? Math.min(...prices) : 0;
});
productSchema.virtual("maxRetailPrice").get(function () {
  const prices = this.variants
    .filter((v) => v.isActive)
    .map((v) => v.pricing.retailPrice || 0);
  return prices.length ? Math.max(...prices) : 0;
});

// ── Middleware ─────────────────────────────────────────────────────────────
productSchema.pre("save", async function (next) {
  // Auto-slug
  if (!this.slug || this.isModified("name")) {
    let base = slugify(this.name, { lower: true, strict: true });
    let slug = base,
      i = 1;
    while (
      await mongoose.model("Product").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }

  // Auto-compute avgRating
  if (this.isModified("reviews") && this.reviews.length > 0) {
    const activeReviews = this.reviews.filter((r) => r.isActive);
    if (activeReviews.length) {
      const sum = activeReviews.reduce((acc, r) => acc + r.rating, 0);
      this.avgRating = +(sum / activeReviews.length).toFixed(1);
    }
  }

  // Auto-build variantName from attributes if not set
  this.variants.forEach((v) => {
    if (!v.variantName && v.attributes.length) {
      v.variantName = v.attributes.map((a) => `${a.value}`).join(" / ");
    }
  });

  next();
});

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.Product || mongoose.model("Product", productSchema);
```

---

## 5. Promotions & Pricing Models

### Discount Priority (cascade rule)

```
FlashSale price              (highest — always wins if active & in stock)
     ↓
Variant-specific discount    (most precise targeting)
     ↓
Product-specific discount
     ↓
Brand-level discount         (brand-wide sale)
     ↓
Category discount            (walks up category tree — most specific wins)
     ↓
Global ("all") discount
     ↓
Original retail price
```

### 5.1 Discount Model (Production-Grade — Multi-Level Targeting & Conditions)

**Key Features:**

- ✅ Multi-level scope: flat | category | product | subCategory | variant | brand
- ✅ Inclusive & exclusive targeting (apply to / exclude from)
- ✅ Advanced conditions: min/max order amount, customer segments, purchase history, verification
- ✅ Usage tracking: global limits, per-customer limits, budget caps
- ✅ Stacking & priority: granular control, combinable discounts
- ✅ Geographic restrictions: region/city/zipcode targeting
- ✅ Payment method filtering
- ✅ Day-of-week restrictions (flash sales, weekend specials)
- ✅ Virtual fields for real-time eligibility checks
- ✅ Instance methods: safe increment, customer eligibility, order qualification, amount calculation
- ✅ Static methods: get applicable discounts with filtering
- ✅ Atomic operations to prevent race conditions in concurrent requests

```js
// src/models/discount.model.js — Production-Grade Discount System
const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const discountSchema = new mongoose.Schema(
  {
    // ── BASIC INFORMATION ────────────────────────────────────────────────────
    discountName: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, unique: true, lowercase: true, index: true },
    discountCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      index: true,
    },
    description: { type: String, trim: true, maxlength: 500 },
    campaignName: { type: String, trim: true, index: true },

    // ── DISCOUNT VALUE ──────────────────────────────────────────────────────
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      required: true,
    },
    discountValue: { type: Number, required: true, min: 0 },
    maxDiscountAmount: { type: Number, default: null }, // Cap for % discounts

    // ── SCOPE & TARGETING ───────────────────────────────────────────────────
    discountPlan: {
      type: String,
      enum: ["flat", "category", "product", "subCategory", "variant", "brand"],
      required: true,
      index: true,
    },

    // Inclusive targeting — which items receive discount
    applicableCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    applicableSubCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" },
    ],
    applicableProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    applicableVariants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
    ],
    applicableBrands: [{ type: mongoose.Schema.Types.ObjectId, ref: "Brand" }],

    // Exclusive targeting — which items are excluded
    excludedProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    excludedCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    ],
    excludedSubCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Subcategory" },
    ],

    // ── TIMING ──────────────────────────────────────────────────────────────
    discountValidFrom: { type: Date, required: true },
    discountValidTo: { type: Date, required: true },
    dayOfWeekRestriction: {
      type: [Number],
      enum: [0, 1, 2, 3, 4, 5, 6],
      default: [],
    }, // 0=Sun..6=Sat

    // ── USAGE LIMITS & TRACKING ─────────────────────────────────────────────
    usageLimit: { type: Number, default: null }, // Null = unlimited
    usedCount: { type: Number, default: 0, min: 0 },
    usagePerCustomer: { type: Number, default: null }, // Max uses per individual

    // ── PURCHASE REQUIREMENTS ───────────────────────────────────────────────
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxOrderAmount: { type: Number, default: null },
    requirePurchaseHistory: { type: Number, default: 0 }, // Min previous purchases
    minimumProductQuantity: { type: Number, default: 1, min: 1 },

    // ── CUSTOMER TARGETING ──────────────────────────────────────────────────
    isNewCustomerOnly: { type: Boolean, default: false },
    isFirstOrderOnly: { type: Boolean, default: false },
    userSegments: [
      {
        type: String,
        enum: ["vip", "regular", "new", "inactive", "high_spender"],
      },
    ],
    applicablePaymentMethods: [
      {
        type: String,
        enum: [
          "credit_card",
          "debit_card",
          "bkash",
          "nagad",
          "bank_transfer",
          "cash_on_delivery",
        ],
      },
    ],

    // Geographic Restrictions
    applicableRegions: [String],
    applicableCities: [String],
    applicableZipCodes: [String],

    // ── STACKING & PRIORITY ─────────────────────────────────────────────────
    priority: { type: Number, default: 0, min: 0, max: 100, index: true },
    isCombinable: { type: Boolean, default: false },
    stackingLimit: { type: Number, default: 1, min: 1 },

    // ── VERIFICATION REQUIREMENTS ───────────────────────────────────────────
    requireEmailVerification: { type: Boolean, default: false },
    requirePhoneVerification: { type: Boolean, default: false },

    // ── ADMIN CONTROLS & ANALYTICS ──────────────────────────────────────────
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    appliedCount: { type: Number, default: 0 },
    totalDiscountGiven: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// ── INDEXES ─────────────────────────────────────────────────────────────────
discountSchema.index({ isActive: 1, discountValidFrom: 1, discountValidTo: 1 });
discountSchema.index({ discountType: 1, priority: -1 });
discountSchema.index({ isCombinable: 1, priority: -1 });
discountSchema.index({ usedCount: 1, usageLimit: 1 });
discountSchema.index({ campaignName: 1, isActive: 1 });
discountSchema.index({ createdBy: 1, createdAt: -1 });

// ── VALIDATIONS ─────────────────────────────────────────────────────────────
discountSchema.pre("save", function (next) {
  if (this.isModified("discountName")) {
    this.slug = slugify(this.discountName, { lower: true, strict: true });
  }
  next();
});

discountSchema.pre("save", async function (next) {
  try {
    const existDiscount = await this.constructor.findOne({ slug: this.slug });
    if (existDiscount && existDiscount._id.toString() !== this._id.toString()) {
      return next(
        new customError(`Discount already exists`, statusCodes.BAD_REQUEST),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

discountSchema.pre("save", function (next) {
  if (this.discountValidTo <= this.discountValidFrom) {
    return next(
      new customError(
        "End date must be after start date",
        statusCodes.BAD_REQUEST,
      ),
    );
  }
  next();
});

// ── VIRTUAL FIELDS ──────────────────────────────────────────────────────────
discountSchema.virtual("isCurrentlyValid").get(function () {
  const now = new Date();
  return (
    this.isActive &&
    now >= this.discountValidFrom &&
    now <= this.discountValidTo
  );
});

discountSchema.virtual("isUsageLimitExhausted").get(function () {
  return this.usageLimit !== null && this.usedCount >= this.usageLimit;
});

discountSchema.virtual("isApplicable").get(function () {
  return this.isCurrentlyValid && !this.isUsageLimitExhausted;
});

discountSchema.virtual("remainingUsage").get(function () {
  if (this.usageLimit === null) return null;
  return Math.max(0, this.usageLimit - this.usedCount);
});

// ── INSTANCE METHODS ────────────────────────────────────────────────────────
// Safe atomic increment with guards
discountSchema.methods.incrementUsage = async function (amount = 1) {
  if (this.usageLimit !== null && this.usedCount + amount > this.usageLimit) {
    throw new customError(
      "Usage limit would be exceeded",
      statusCodes.BAD_REQUEST,
    );
  }
  const result = await this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { usedCount: amount } },
    { new: true, runValidators: true },
  );
  return result;
};

// Track discount application + amount given
discountSchema.methods.trackApplication = async function (discountAmount = 0) {
  return await this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { appliedCount: 1, totalDiscountGiven: discountAmount } },
    { new: true },
  );
};

// Check customer eligibility with detailed reasons
discountSchema.methods.isEligibleForCustomer = function (customer = {}) {
  const reasons = [];
  if (this.isNewCustomerOnly && customer.isNewCustomer === false) {
    reasons.push("Only for new customers");
  }
  if (this.isFirstOrderOnly && (customer.totalOrders || 0) > 0) {
    reasons.push("Only for first-time orders");
  }
  if (
    this.userSegments.length > 0 &&
    customer.segment &&
    !this.userSegments.includes(customer.segment)
  ) {
    reasons.push(`Not available for ${customer.segment} segment`);
  }
  if (
    this.requirePurchaseHistory > 0 &&
    (customer.totalOrders || 0) < this.requirePurchaseHistory
  ) {
    reasons.push(`Requires ${this.requirePurchaseHistory} prior purchases`);
  }
  if (this.requireEmailVerification && !customer.isEmailVerified) {
    reasons.push("Email verification required");
  }
  if (this.requirePhoneVerification && !customer.isPhoneVerified) {
    reasons.push("Phone verification required");
  }
  return { isEligible: reasons.length === 0, reasons };
};

// Check order qualification with detailed reasons
discountSchema.methods.isOrderQualified = function (order = {}) {
  const reasons = [];
  if (!this.isCurrentlyValid) reasons.push("Not currently valid");
  if (!this.isActive) reasons.push("Inactive");
  if (this.isUsageLimitExhausted) reasons.push("Usage limit reached");
  if ((order.totalAmount || 0) < this.minOrderAmount) {
    reasons.push(`Minimum ৳${this.minOrderAmount} required`);
  }
  if (
    this.maxOrderAmount !== null &&
    (order.totalAmount || 0) > this.maxOrderAmount
  ) {
    reasons.push(`Exceeds max ৳${this.maxOrderAmount}`);
  }
  if (this.dayOfWeekRestriction.length > 0) {
    const dayOfWeek = new Date().getDay();
    if (!this.dayOfWeekRestriction.includes(dayOfWeek)) {
      reasons.push("Not available today");
    }
  }
  if (
    this.applicablePaymentMethods.length > 0 &&
    order.paymentMethod &&
    !this.applicablePaymentMethods.includes(order.paymentMethod)
  ) {
    reasons.push(`Not available for ${order.paymentMethod}`);
  }
  return { isQualified: reasons.length === 0, reasons };
};

// Calculate final discount amount
discountSchema.methods.calculateDiscountAmount = function (baseAmount = 0) {
  let amount =
    this.discountType === "fixed"
      ? this.discountValue
      : (baseAmount * this.discountValue) / 100;
  if (this.maxDiscountAmount !== null && amount > this.maxDiscountAmount) {
    amount = this.maxDiscountAmount;
  }
  return amount;
};

// ── STATIC METHODS ──────────────────────────────────────────────────────────
// Get all applicable discounts (sorted by priority)
discountSchema.statics.getApplicableDiscounts = async function (filters = {}) {
  const query = {
    isActive: true,
    discountValidFrom: { $lte: new Date() },
    discountValidTo: { $gte: new Date() },
  };
  if (filters.productId) {
    query.$or = [
      { applicableProducts: filters.productId },
      { discountPlan: "flat" },
    ];
  }
  if (filters.categoryId) {
    query.$or = query.$or || [];
    query.$or.push({ applicableCategories: filters.categoryId });
  }
  if (filters.excludeProductIds?.length > 0) {
    query.excludedProducts = { $nin: filters.excludeProductIds };
  }
  return await this.find(query).sort({ priority: -1 });
};

module.exports =
  mongoose.models.Discount || mongoose.model("Discount", discountSchema);
```

**Example use cases:**

```js
// Category-wide festival sale
{
  discountName: "Eid Electronics Sale",
  discountPlan: "category",
  discountType: "percentage",
  discountValue: 15,
  maxDiscountAmount: 5000,
  applicableCategories: ["ObjectId(electronics)"],
  minOrderAmount: 10000,
  discountValidFrom: "2026-03-29T00:00:00Z",
  discountValidTo: "2026-04-05T23:59:59Z",
  isCombinable: true,
  priority: 5
}

// VIP-only product discount
{
  discountName: "VIP Member Exclusive",
  discountPlan: "product",
  discountType: "fixed",
  discountValue: 2000,
  applicableProducts: ["ObjectId(premium_item)"],
  userSegments: ["vip"],
  usagePerCustomer: 2,
  usageLimit: 100,
  priority: 8
}

// Weekend flash sale on specific variant
{
  discountName: "Weekend Special - iPhone 15 Pro",
  discountPlan: "variant",
  discountType: "percentage",
  discountValue: 8,
  applicableVariants: ["ObjectId(iphone15-pro-128gb)"],
  dayOfWeekRestriction: [5, 6], // Fri, Sat
  discountValidFrom: "2026-05-16T00:00:00Z",
  discountValidTo: "2026-05-18T23:59:59Z",
  priority: 10
}

// New customer first order bonus
{
  discountName: "Welcome New Customers",
  discountPlan: "flat",
  discountType: "percentage",
  discountValue: 20,
  isNewCustomerOnly: true,
  isFirstOrderOnly: true,
  minOrderAmount: 5000,
  usagePerCustomer: 1,
  priority: 7
}
```

````

**Discount Resolution Service:**

```js
// src/service/discount.service.js
// Call this when rendering product price on storefront.
// Flash sale check happens BEFORE this in getEffectivePrice().
async function resolveDiscount(productId, variantId, categoryId, brandId, ctx = {}) {
  const now = new Date();
  const { customerId, customerSegment = "all", quantity = 1, orderAmount = 0 } = ctx;

  const baseQuery = {
    isActive: true,
    validFrom: { $lte: now },
    validTo: { $gte: now },
    $or: [
      { "conditions.customerSegment": "all" },
      { "conditions.customerSegment": customerSegment },
    ],
    "conditions.minQuantity": { $lte: quantity },
    "conditions.minOrderAmount": { $lte: orderAmount },
  };

  const candidates = [];

  // 1. Variant-level — most precise
  const variantDiscount = await Discount.findOne({
    ...baseQuery,
    scope: "variant",
    "variants.product": productId,
    "variants.variantId": variantId,
  }).sort({ priority: -1 });
  if (variantDiscount) candidates.push({ discount: variantDiscount, level: 5 });

  // 2. Product-level
  const productDiscount = await Discount.findOne({
    ...baseQuery,
    scope: "product",
    products: productId,
  }).sort({ priority: -1 });
  if (productDiscount) candidates.push({ discount: productDiscount, level: 4 });

  // 3. Brand-level
  if (brandId) {
    const brandDiscount = await Discount.findOne({
      ...baseQuery,
      scope: "brand",
      brands: brandId,
    }).sort({ priority: -1 });
    if (brandDiscount) candidates.push({ discount: brandDiscount, level: 3 });
  }

  // 4. Category — walk up the tree, most specific wins
  const categoryIds = await getCategoryAncestors(categoryId); // [self, parent, grandparent...]
  const categoryDiscount = await Discount.findOne({
    ...baseQuery,
    scope: "category",
    categories: { $in: categoryIds },
  }).sort({ priority: -1 });
  if (categoryDiscount) candidates.push({ discount: categoryDiscount, level: 2 });

  // 5. Global
  const globalDiscount = await Discount.findOne({
    ...baseQuery,
    scope: "all",
  }).sort({ priority: -1 });
  if (globalDiscount) candidates.push({ discount: globalDiscount, level: 1 });

  if (!candidates.length) return null;

  // Pick highest level; tie-break by priority then discountValue
  candidates.sort((a, b) =>
    b.level !== a.level
      ? b.level - a.level
      : b.discount.priority !== a.discount.priority
        ? b.discount.priority - a.discount.priority
        : b.discount.discountValue - a.discount.discountValue,
  );

  const winner = candidates[0].discount;

  // Budget / usage guard — skip if exhausted
  if (winner.limits.usageLimit && winner.limits.usageCount >= winner.limits.usageLimit)
    return null;
  if (winner.limits.budgetCap && winner.limits.budgetUsed >= winner.limits.budgetCap)
    return null;

  return winner;
}

// Apply discount to a price and increment counters atomically
async function applyDiscount(discountId, originalPrice) {
  const discount = await Discount.findById(discountId);
  if (!discount) return { finalPrice: originalPrice, deduction: 0 };

  let deduction = 0;
  let finalPrice = originalPrice;

  if (discount.discountType === "percentage") {
    deduction = (originalPrice * discount.discountValue) / 100;
    if (discount.maxDiscountAmount) deduction = Math.min(deduction, discount.maxDiscountAmount);
    finalPrice = originalPrice - deduction;
  } else if (discount.discountType === "fixed") {
    deduction = Math.min(discount.discountValue, originalPrice);
    finalPrice = originalPrice - deduction;
  } else if (discount.discountType === "fixed_price") {
    finalPrice = discount.discountValue;
    deduction = Math.max(0, originalPrice - finalPrice);
  }

  // Increment counters atomically
  await Discount.findByIdAndUpdate(discountId, {
    $inc: {
      "limits.usageCount": 1,
      "limits.budgetUsed": deduction,
    },
  });

  return { finalPrice: Math.max(0, finalPrice), deduction };
}
````

---

### 5.2 FlashSale Model (New)

```js
// src/models/flashSale.model.js
// Flash sale = time-limited, per-item stock cap, shown with countdown.
// Highest discount priority — always overrides regular discount if active.
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const imageSchema = require("./schemas/image.schema");
const { Schema } = mongoose;

const flashSaleItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: Schema.Types.ObjectId, required: true },
    // Snapshot (denormalized for performance — no join needed for listing)
    productName: { type: String, default: "" },
    variantName: { type: String, default: "" },
    variantAttributes: {
      type: [{ key: String, value: Schema.Types.Mixed }],
      default: [],
    },
    originalPrice: { type: Number, required: true, min: 0 },

    // Flash price config
    flashPrice: { type: Number, required: true, min: 0 },
    discountType: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    discountValue: { type: Number, required: true, min: 0 },

    // Stock control: how many units are in the flash sale pool
    saleStock: { type: Number, required: true, min: 1 }, // allocated for this flash sale
    soldCount: { type: Number, default: 0, min: 0 },

    isActive: { type: Boolean, default: true },
  },
  { _id: true },
);

flashSaleItemSchema.virtual("remainingStock").get(function () {
  return Math.max(0, this.saleStock - this.soldCount);
});
flashSaleItemSchema.virtual("isSoldOut").get(function () {
  return this.soldCount >= this.saleStock;
});
flashSaleItemSchema.virtual("discountPercent").get(function () {
  if (!this.originalPrice) return 0;
  return +(
    ((this.originalPrice - this.flashPrice) / this.originalPrice) *
    100
  ).toFixed(1);
});

const flashSaleSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    banner: { type: imageSchema, default: () => ({}) },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    items: { type: [flashSaleItemSchema], default: [] },
    priority: { type: Number, default: 10 }, // above normal discount
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Compound index for fetching active flash sales
flashSaleSchema.index({ isActive: 1, startAt: 1, endAt: 1 });

flashSaleSchema.virtual("isLive").get(function () {
  const now = new Date();
  return this.isActive && now >= this.startAt && now <= this.endAt;
});
flashSaleSchema.virtual("isUpcoming").get(function () {
  return this.isActive && new Date() < this.startAt;
});
flashSaleSchema.virtual("isExpired").get(function () {
  return new Date() > this.endAt;
});

flashSaleSchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("name")) {
    let base = slugify(this.name, { lower: true, strict: true });
    let slug = base,
      i = 1;
    while (
      await mongoose.model("FlashSale").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }
  next();
});

// Validation: endAt must be after startAt
flashSaleSchema.pre("save", function (next) {
  if (this.endAt <= this.startAt) {
    return next(
      new customError("endAt must be after startAt", statusCodes.BAD_REQUEST),
    );
  }
  next();
});

module.exports =
  mongoose.models.FlashSale || mongoose.model("FlashSale", flashSaleSchema);
```

**Flash Sale usage at checkout:**

```js
// When adding to cart / calculating price:
async function getEffectivePrice(productId, variantId) {
  const now = new Date();
  // 1. Check active flash sale first
  const flashSale = await FlashSale.findOne({
    isActive: true,
    startAt: { $lte: now },
    endAt: { $gte: now },
    "items.product": productId,
    "items.variantId": variantId,
    "items.isActive": true,
  });
  if (flashSale) {
    const item = flashSale.items.find(
      (i) => i.product.equals(productId) && i.variantId.equals(variantId),
    );
    if (item && item.soldCount < item.saleStock) {
      return {
        price: item.flashPrice,
        source: "flashSale",
        flashSaleItemId: item._id,
      };
    }
  }
  // 2. Fall through to regular discount resolution
  return resolveDiscount(productId, variantId);
}
```

---

### 5.3 Coupon Model (Unchanged — shown for reference)

```js
// src/models/coupon.model.js — NO CHANGES from v1
// Coupon is applied at CHECKOUT on the order total.
// It does NOT override product price — it reduces the order total.
// isStackable on Discount controls whether a coupon can combine with a discount.
```

---

### 5.4 Banner Model (Merged)

```js
// src/models/banner.model.js
// Merges old banner.model.js + discountBanner.model.js into one.
// Use 'type' to distinguish UI placement.
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const imageSchema = require("./schemas/image.schema");
const { Schema } = mongoose;

const bannerSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    type: {
      type: String,
      enum: [
        "hero_slider",
        "promo_banner",
        "discount_banner",
        "popup",
        "category_banner",
      ],
      required: true,
      default: "hero_slider",
      index: true,
    },
    image: { type: imageSchema, default: () => ({}) },
    link: { type: String, trim: true, default: "" },
    headLine: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    priority: { type: Number, default: 0 },
    // Optional: link banner to a flash sale or discount
    flashSale: { type: Schema.Types.ObjectId, ref: "FlashSale", default: null },
    discount: { type: Schema.Types.ObjectId, ref: "Discount", default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

bannerSchema.pre("save", async function (next) {
  if (!this.slug || this.isModified("title")) {
    let base = slugify(this.title, { lower: true, strict: true });
    let slug = base,
      i = 1;
    while (
      await mongoose.model("Banner").exists({ slug, _id: { $ne: this._id } })
    ) {
      slug = `${base}-${i++}`;
    }
    this.slug = slug;
  }
  next();
});

bannerSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  if (update.title) {
    update.slug = slugify(update.title, { lower: true, strict: true });
  }
  next();
});

module.exports =
  mongoose.models.Banner || mongoose.model("Banner", bannerSchema);
```

---

## 6. Auth & RBAC Models

### RBAC Architecture

```
SuperAdmin (isSuperAdmin=true)
    → Bypasses all permission checks

Regular User
    → Has Roles[]
         → Each Role has Permissions[]
              → Permission: { permissionName, slug, isActive }

    → Has direct permissionOverrides[]
         → { permission: ObjectId, type: "grant"|"deny" }
         → "deny" wins over everything (explicit deny)
         → "grant" works even without a matching role

Check order: isSuperAdmin → deny override → grant override → role permissions
```

### 6.1 Permission Model (Keep Existing Style — Minor Update)

```js
// src/models/permission.model.js
// Keeping your existing style. Just adds 'module' and 'action' fields
// for better filtering/grouping in the admin UI.
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const permissionSchema = new mongoose.Schema(
  {
    permissionName: {
      type: String,
      required: [true, "Permission name is required"],
      unique: true,
      trim: true,
    }, // "Create Product"
    slug: { type: String, unique: true, index: true }, // "product-create"
    // New in v2: module grouping for admin UI
    module: { type: String, trim: true, lowercase: true, default: "" }, // "product"
    action: { type: String, trim: true, lowercase: true, default: "" }, // "create"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

permissionSchema.pre("save", function (next) {
  if (this.isModified("permissionName")) {
    this.slug = slugify(this.permissionName, { lower: true, strict: true });
  }
  next();
});

permissionSchema.pre("insertMany", function (next, docs) {
  docs.forEach((doc) => {
    doc.slug = slugify(doc.permissionName, { lower: true, strict: true });
  });
  next();
});

permissionSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({ slug: this.slug });
    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          "Permission name already exists",
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
  mongoose.models.Permission || mongoose.model("Permission", permissionSchema);
```

**Seed permissions:**

```js
// src/seeder/permissions.seeder.js
const permissions = [
  { permissionName: "View Dashboard", module: "dashboard", action: "read" },
  // Product
  { permissionName: "Create Product", module: "product", action: "create" },
  { permissionName: "Read Product", module: "product", action: "read" },
  { permissionName: "Update Product", module: "product", action: "update" },
  { permissionName: "Delete Product", module: "product", action: "delete" },
  // Category
  { permissionName: "Create Category", module: "category", action: "create" },
  { permissionName: "Read Category", module: "category", action: "read" },
  { permissionName: "Update Category", module: "category", action: "update" },
  { permissionName: "Delete Category", module: "category", action: "delete" },
  // Brand
  { permissionName: "Create Brand", module: "brand", action: "create" },
  { permissionName: "Read Brand", module: "brand", action: "read" },
  { permissionName: "Update Brand", module: "brand", action: "update" },
  { permissionName: "Delete Brand", module: "brand", action: "delete" },
  // Order
  { permissionName: "Create Order", module: "order", action: "create" },
  { permissionName: "Read Order", module: "order", action: "read" },
  { permissionName: "Update Order", module: "order", action: "update" },
  { permissionName: "Delete Order", module: "order", action: "delete" },
  // Discount
  { permissionName: "Manage Discount", module: "discount", action: "manage" },
  {
    permissionName: "Manage Flash Sale",
    module: "flashsale",
    action: "manage",
  },
  { permissionName: "Manage Coupon", module: "coupon", action: "manage" },
  // Purchase/Sales
  { permissionName: "Create Purchase", module: "purchase", action: "create" },
  { permissionName: "Read Purchase", module: "purchase", action: "read" },
  { permissionName: "Create Sales", module: "sales", action: "create" },
  { permissionName: "Read Sales", module: "sales", action: "read" },
  // Customer/Supplier
  { permissionName: "Manage Customer", module: "customer", action: "manage" },
  { permissionName: "Manage Supplier", module: "supplier", action: "manage" },
  // Employee
  { permissionName: "Manage Employee", module: "employee", action: "manage" },
  // User/Role/Permission (admin)
  { permissionName: "Manage User", module: "user", action: "manage" },
  { permissionName: "Manage Role", module: "role", action: "manage" },
  {
    permissionName: "Manage Permission",
    module: "permission",
    action: "manage",
  },
  // Reports
  { permissionName: "View Reports", module: "report", action: "read" },
  { permissionName: "Export Reports", module: "report", action: "export" },
  // Stock
  { permissionName: "Adjust Stock", module: "stock", action: "adjust" },
  // Finance
  { permissionName: "Manage Accounts", module: "account", action: "manage" },
  {
    permissionName: "Manage Transactions",
    module: "transaction",
    action: "manage",
  },
];
```

---

### 6.2 Role Model (Updated — adds permissions array)

```js
// src/models/role.model.js
const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, unique: true, index: true },
    // v2: Role now carries its permissions directly
    permissions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Permission" }],
    // isSystem = cannot be deleted (super-admin, customer roles)
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

roleSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

roleSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({ slug: this.slug });
    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Role "${this.name}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Prevent deleting system roles
roleSchema.pre("deleteOne", { document: true }, async function (next) {
  if (this.isSystem) {
    return next(
      new customError("Cannot delete a system role", statusCodes.BAD_REQUEST),
    );
  }
  next();
});

module.exports = mongoose.models.Role || mongoose.model("Role", roleSchema);
```

**Seed system roles:**

```js
const systemRoles = [
  { name: "Super Admin", isSystem: true, permissions: [] }, // isSuperAdmin flag handles bypass
  { name: "Admin", isSystem: true, permissions: "ALL_PERMISSIONS" },
  { name: "Manager", isSystem: false },
  { name: "Sales Staff", isSystem: false },
  {
    name: "Customer",
    isSystem: true,
    permissions: ["Create Order", "Read Order"],
  },
];
```

---

### 6.3 User Model (Updated RBAC)

```js
// src/models/user.model.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const imageSchema = require("./schemas/image.schema");

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: "", trim: true },
    line2: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true },
    state: { type: String, default: "", trim: true },
    country: { type: String, default: "", trim: true },
    zipCode: { type: String, default: "", trim: true },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, select: false },
    phone: { type: String, default: "", trim: true, sparse: true },
    image: { type: imageSchema, default: () => ({}) },
    address: { type: addressSchema, default: () => ({}) },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    dateOfBirth: { type: Date, default: null },

    // ── RBAC ──────────────────────────────────────────────────────────────
    // Primary: user gets permissions via their assigned roles
    roles: [{ type: mongoose.Schema.Types.ObjectId, ref: "Role" }],

    // Override: super admin can grant or deny specific permissions directly
    // deny overrides everything including roles; grant works even without matching role
    permissionOverrides: [
      {
        permission: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Permission",
          required: true,
        },
        type: { type: String, enum: ["grant", "deny"], default: "grant" },
      },
    ],

    // Super admin flag — stored select:false for security
    // This bypasses ALL permission checks in authorize middleware
    isSuperAdmin: { type: Boolean, default: false, select: false },

    // ── Verification ──────────────────────────────────────────────────────
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },

    // ── Security ──────────────────────────────────────────────────────────
    isBlocked: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false },
    refreshToken: { type: String, select: false },
    lastlogin: { type: Date, default: null },
    lastLogout: { type: Date, default: null },

    // ── E-commerce ────────────────────────────────────────────────────────
    wishList: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    newsLetterSubscribe: { type: Boolean, default: false },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

// Hash password
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

userSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate() || {};
    const $set = update.$set || update;
    if ($set.password) {
      $set.password = await bcrypt.hash($set.password, 12);
    }
    if (update.$set) update.$set = $set;
    else Object.assign(update, $set);
    this.setUpdate(update);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateJwtAccessToken = function () {
  return jwt.sign(
    { id: this._id, email: this.email, name: this.name },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" },
  );
};

userSchema.methods.generateJwtRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.REFRESH_TOKEN_SCCERET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

userSchema.methods.verifyJwtRefreshToken = function (token) {
  return jwt.verify(token, process.env.REFRESH_TOKEN_SCCERET);
};

module.exports = mongoose.models.User || mongoose.model("User", userSchema);
```

---

### 6.4 Auth Middleware (Updated)

```js
// src/middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const authGuard = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.split(" ")[1]
      : req.body?.token;

    if (!token) throw new customError("Unauthorized", statusCodes.UNAUTHORIZED);

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decoded.id)
      .select("+isSuperAdmin +password") // password for comparePassword usage
      .populate({
        path: "roles",
        match: { isActive: true },
        populate: { path: "permissions", match: { isActive: true } },
      })
      .populate("permissionOverrides.permission")
      .lean();

    if (!user) throw new customError("Unauthorized", statusCodes.UNAUTHORIZED);
    if (!user.isActive)
      throw new customError("Account is inactive", statusCodes.UNAUTHORIZED);
    if (user.isBlocked)
      throw new customError("Account is blocked", statusCodes.FORBIDDEN);

    req.user = user;
    next();
  } catch (err) {
    if (err instanceof customError) return next(err);
    next(new customError("Invalid or expired token", statusCodes.UNAUTHORIZED));
  }
};

module.exports = { authGuard };
```

---

### 6.5 authorize Middleware (Updated)

```js
// src/middleware/checkPermission.middleware.js
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

/**
 * Usage: authorize("product-create")
 *        authorize("order-read")
 * Slug matches Permission.slug (slugified permissionName)
 *
 * Check order:
 *  1. isSuperAdmin → pass
 *  2. deny override → block
 *  3. grant override → pass
 *  4. role permission → pass/block
 */
const authorize = (permissionSlug) => (req, res, next) => {
  const user = req.user;
  if (!user)
    return next(new customError("Unauthorized", statusCodes.UNAUTHORIZED));

  // 1. Super admin bypasses everything
  if (user.isSuperAdmin) return next();

  // 2. Check deny overrides (explicit deny wins over everything)
  const isDenied = user.permissionOverrides?.some(
    (o) => o.type === "deny" && o.permission?.slug === permissionSlug,
  );
  if (isDenied) {
    return next(new customError("Access denied", statusCodes.FORBIDDEN));
  }

  // 3. Check direct grant overrides
  const isGranted = user.permissionOverrides?.some(
    (o) => o.type === "grant" && o.permission?.slug === permissionSlug,
  );
  if (isGranted) return next();

  // 4. Check role-based permissions
  const hasRolePermission = user.roles?.some(
    (role) =>
      role.isActive &&
      role.permissions?.some((p) => p.slug === permissionSlug && p.isActive),
  );
  if (hasRolePermission) return next();

  return next(
    new customError(
      `Forbidden: requires "${permissionSlug}"`,
      statusCodes.FORBIDDEN,
    ),
  );
};

module.exports = { authorize };
```

---

## 7. Commerce Models (Minor Updates)

### 7.1 Cart Model

#### Guest vs Logged User — দুটো flow এক model-এ

```
GUEST USER
  Frontend: guestId = uuid()  →  localStorage-এ শুধু এটুকুই রাখো
  POST /cart/items { guestId, productId, variantId, qty }
  Server: Cart { user: null, guestId: "uuid", expiresAt: now+7days }
                                               ↑ TTL index — MongoDB auto-delete

LOGIN হলে (Guest → User transition)
  POST /cart/merge { guestId }  +  Authorization: Bearer <token>
  Server:
    ├── user cart নেই  →  guest cart-এর user=userId, guestId=null, expiresAt=null
    └── user cart আছে  →  guest items → user cart-এ merge, guest cart delete

LOGGED USER
  POST /cart/items  (Authorization: Bearer <token>)
  Server: Cart { user: ObjectId, guestId: null, expiresAt: null }
```

**মূল নীতি:**

- `user` এবং `guestId` — একটাই set থাকবে, কখনো দুটো একসাথে নয়
- `unitPrice` সবসময় server থেকে (`variant.pricing.retailPrice`) — client-sent price কখনো trust করা যাবে না
- Cart item-এ snapshot store করো — display-এ Product join লাগবে না
- Guest cart 7 দিন inactivity-তে MongoDB TTL index auto-delete করবে

```js
// src/models/cart.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// ── Cart Item ──────────────────────────────────────────────────────────────
const cartItemSchema = new Schema(
  {
    // ── Reference ──────────────────────────────────────────────────────────
    product: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // v2: variant embedded-in-Product — এটা Product.variants[i]._id
    // আলাদা Variant collection ref নয় (v2-তে সেই collection নেই)
    variantId: {
      type: Schema.Types.ObjectId,
      required: true,
    },

    // ── Snapshot (display-এর জন্য, Product আবার fetch করতে হবে না) ─────────
    // Service layer add-to-cart-এ set করবে। পরে read-only।
    productName: { type: String, default: "" },
    variantName: { type: String, default: "" }, // e.g. "Red / XL"
    sku: { type: String, default: "" },
    image: { type: String, default: "" }, // variant image URL, fallback → product image

    // v2 dynamic attributes — পুরনো hardcoded `color` + `size` string replace করেছে
    // Product.variants[i].attributes: [{ key: "Color", value: "Red" }, { key: "Size", value: "XL" }]
    attributes: {
      type: [{ key: String, value: Schema.Types.Mixed }],
      default: [],
    },

    // ── Pricing (server-set — client value কখনো নয়) ───────────────────────
    quantity: { type: Number, required: true, min: 1, default: 1 },

    // originalPrice = variant.pricing.retailPrice (discount apply করার আগের price)
    // cart display-এ strikethrough দেখানোর জন্য দরকার: ~~৳1300~~ ৳1105
    originalPrice: { type: Number, required: true, default: 0, min: 0 },

    // discount engine যদি match করে তাহলে এখানে snapshot রাখো
    // cart page-এ "15% Eid Discount applied" badge দেখাতে পারবে
    appliedDiscount: {
      discountId: {
        type: Schema.Types.ObjectId,
        ref: "Discount",
        default: null,
      },
      discountType: { type: String, default: "" }, // "percentage" | "fixed" | "fixed_price"
      deduction: { type: Number, default: 0, min: 0 }, // কত টাকা কমেছে
      badge: { type: String, default: "" }, // "15% OFF", "EID SALE" — UI label
    },

    // unitPrice = originalPrice - appliedDiscount.deduction (service layer calculates)
    // discount না থাকলে unitPrice === originalPrice
    unitPrice: { type: Number, required: true, default: 0, min: 0 },
    totalPrice: { type: Number, required: true, default: 0, min: 0 }, // unitPrice × quantity

    // ── Gap 1: Price staleness tracker ────────────────────────────────────
    // cart GET-এ service layer: variant.pricing.retailPrice !== item.originalPrice
    // হলে isStale virtual = true → frontend "Price changed" warning দেখাবে
    priceUpdatedAt: { type: Date, default: Date.now },

    // ── Gap 3: Stock visibility in cart ───────────────────────────────────
    // cart GET ও mutation-এ service layer variant.stock.quantity check করে refresh করবে
    // checkout button disable করবে "out_of_stock" item থাকলে
    stockStatus: {
      type: String,
      enum: ["available", "low_stock", "out_of_stock"],
      default: "available",
    },
  },
  {
    _id: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// isStale virtual — cart GET-এ service layer current price pass করলে compare করে
// সরাসরি DB-তে store না করে virtual রাখা হয়েছে — DB write cost নেই
cartItemSchema.virtual("isStale").get(function () {
  // service layer এটা set করবে না — frontend stale check করবে priceUpdatedAt দিয়ে
  // অথবা service layer cart load-এ item.originalPrice vs live price compare করবে
  return false; // placeholder — actual check service layer-এ
});

// ── Cart ───────────────────────────────────────────────────────────────────
const cartSchema = new Schema(
  {
    // এই দুটোর মধ্যে সবসময় একটাই set — কখনো দুটো একসাথে নয়
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    guestId: { type: String, default: null },

    items: { type: [cartItemSchema], default: [] },
    subTotal: { type: Number, default: 0, min: 0 }, // all item.totalPrice এর sum
    totalItem: { type: Number, default: 0, min: 0 }, // all item.quantity এর sum

    // Guest cart TTL — গেস্ট cart-এ date set করো, logged-in cart-এ null
    // প্রতি cart mutation-এ guest-এর expiresAt reset করো (sliding window)
    // MongoDB TTL index: expiresAt পার হলে document auto-delete হয়
    // null value TTL index ignore করে — user cart কখনো delete হবে না
    expiresAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// ── Indexes ────────────────────────────────────────────────────────────────
cartSchema.index({ user: 1 });
cartSchema.index({ guestId: 1 });
// TTL index: MongoDB ~60s interval-এ check করে, expiresAt <= now হলে delete
// expireAfterSeconds: 0 মানে ঠিক expiresAt time-এ delete (কোনো extra delay নেই)
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
```

**v1 → v2 field mapping:**

| v1 field                 | v2 field                                     | কারণ                                                |
| ------------------------ | -------------------------------------------- | --------------------------------------------------- |
| `variant: ref "Variant"` | `variantId: ObjectId`                        | Variant আলাদা collection নেই, Product-এ embedded    |
| `color: String`          | `attributes: [{key,value}]`                  | Dynamic — hardcoded color/size নয়                  |
| `size: String`           | (attributes-এর ভেতরে)                        |                                                     |
| `price: Number`          | `unitPrice: Number`                          | নাম clarify করা হয়েছে                              |
| নেই                      | `productName`, `variantName`, `sku`, `image` | Snapshot — join ছাড়া cart display                  |
| নেই                      | `originalPrice` + `appliedDiscount`          | Strikethrough price + discount badge in cart UI     |
| নেই                      | `priceUpdatedAt`                             | Price change detection — "Price changed" warning    |
| নেই                      | `stockStatus`                                | Out-of-stock badge in cart, checkout button disable |
| নেই                      | `expiresAt: Date`                            | Guest cart auto-cleanup via MongoDB TTL             |
| নেই                      | `timestamps: true`                           | Cart age + abandoned cart analytics                 |

**Service layer-এ price, discount ও snapshot নেওয়ার pattern:**

```js
// add-to-cart service — সব value server-এ calculate করো
const product = await Product.findOne({
  _id: productId,
  "variants._id": variantId,
  isActive: true,
  isDeleted: false,
});
const variant = product.variants.id(variantId); // embedded subdoc helper

// ── Stock check ────────────────────────────────────────────────────────────
if (variant.stock.quantity < quantity)
  throw new customError(`Only ${variant.stock.quantity} units available`, 400);

const stockStatus =
  variant.stock.quantity === 0
    ? "out_of_stock"
    : variant.stock.quantity <= variant.stock.alertThreshold
      ? "low_stock"
      : "available";

// ── Price (Gap 1 + Gap 2) ──────────────────────────────────────────────────
const originalPrice = variant.pricing.retailPrice; // discount-এর আগের price

// discount engine থেকে effective discount বের করো
const discount = await resolveDiscount(
  product._id,
  variant._id,
  product.category,
  product.brand,
  { quantity, orderAmount: originalPrice * quantity },
);

let deduction = 0;
let appliedDiscount = {
  discountId: null,
  discountType: "",
  deduction: 0,
  badge: "",
};

if (discount) {
  const result = await applyDiscount(discount._id, originalPrice); // counters increment
  deduction = result.deduction;
  appliedDiscount = {
    discountId: discount._id,
    discountType: discount.discountType,
    deduction,
    badge: discount.badge || "",
  };
}

const unitPrice = originalPrice - deduction;
const totalPrice = unitPrice * quantity;

// ── Snapshot ───────────────────────────────────────────────────────────────
const snapshot = {
  productName: product.name,
  variantName: variant.variantName || "",
  sku: variant.sku || "",
  image: variant.images?.[0]?.url || product.images?.[0]?.url || "",
  attributes: variant.attributes || [],
};

// cart item push করো এই সব data দিয়ে
cart.items.push({
  product: product._id,
  variantId: variant._id,
  ...snapshot,
  quantity,
  originalPrice,
  appliedDiscount,
  unitPrice,
  totalPrice,
  priceUpdatedAt: new Date(), // Gap 1: staleness tracker reset
  stockStatus, // Gap 3: stock visibility
});
```

**Cart GET-এ price staleness check (Gap 1):**

```js
// cart load হলে প্রতিটা item-এর live price vs stored price compare করো
for (const item of cart.items) {
  const product = await Product.findOne({
    _id: item.product,
    "variants._id": item.variantId,
  });
  if (!product) {
    item.stockStatus = "out_of_stock";
    continue;
  }

  const variant = product.variants.id(item.variantId);
  const livePrice = variant.pricing.retailPrice;

  // Gap 1: price বদলে গেছে?
  if (livePrice !== item.originalPrice) {
    item.originalPrice = livePrice;
    item.priceUpdatedAt = new Date(); // frontend এই timestamp দিয়ে "Price changed" দেখাবে
    // discount re-resolve করো নতুন price-এ
  }

  // Gap 3: stock status refresh
  item.stockStatus =
    variant.stock.quantity === 0
      ? "out_of_stock"
      : variant.stock.quantity <= variant.stock.alertThreshold
        ? "low_stock"
        : "available";
}
await cart.save();
```

### 7.2 Order Model (Updated items array)

```js
// src/models/order.model.js — only the items array changes, rest stays same
// Old: items had no variantId
// New: items stores productId + variantId + full snapshot (immutable record)

const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variantId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Snapshot — NEVER mutate after order placed
    productName: { type: String, required: true },
    variantName: { type: String, default: "" },
    sku: { type: String, default: "" },
    barCode: { type: String, default: "" },
    attributes: {
      type: [{ key: String, value: mongoose.Schema.Types.Mixed }],
      default: [],
    },
    image: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true }, // effective price (after discount/flash)
    originalPrice: { type: Number, required: true }, // retail price before discount
    discount: { type: Number, default: 0 }, // discount amount applied
    totalPrice: { type: Number, required: true }, // unitPrice × quantity
  },
  { _id: true },
);
// ... rest of orderSchema stays the same as v1
```

### 7.3 Purchase Model (Updated line items)

```js
// src/models/purchase.model.js — only allproduct items change
// Old: had hardcoded size + color strings
// New: variantId + attribute snapshot

const purchaseItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: mongoose.Schema.Types.ObjectId }, // embedded variant _id
    // Snapshot at time of purchase (audit trail)
    variantName: { type: String, default: "" },
    sku: { type: String, default: "" },
    barCode: { type: String, default: "" },
    attributes: {
      type: [{ key: String, value: mongoose.Schema.Types.Mixed }],
      default: [],
    },
    purchasePrice: { type: Number, min: 0 },
    retailPrice: { type: Number, min: 0 },
    subTotal: { type: Number, default: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);
// ... rest of purchaseSchema stays the same as v1 (invoiceNumber, supplierId, etc.)
```

---

## 8. Unchanged Models

These models need NO changes in v2. Keep them exactly as-is:

| Model File                         | Collections                                                            |
| ---------------------------------- | ---------------------------------------------------------------------- |
| `sales.model.js`                   | Sales                                                                  |
| `salesReturn.model.js`             | SalesReturn                                                            |
| `byReturnSale.model.js`            | ByReturn                                                               |
| `coupon.model.js`                  | Coupon                                                                 |
| `customer.model.js`                | Customer, CustomerType, CustomerPaymentRecived, CustomerAdvancePayment |
| `supplier.model.js`                | Supplier, SupplierDuePayment                                           |
| `employee.model.js`                | Employee                                                               |
| `advancePayment.model.js`          | EmployeeAdvancePayment, EmployeeDesignation, Department, Section       |
| `stockadjust.model.js`             | StockAdjust                                                            |
| `account.model.js`                 | Account                                                                |
| `moneyTransfer.model.js`           | MoneyTransfer                                                          |
| `crateTransaction.model.js`        | CrateTransaction                                                       |
| `fundHandoverDescription.model.js` | FundHandoverDescription                                                |
| `transitionCategory.model.js`      | TransitionCategory                                                     |
| `counter.model.js`                 | Counter                                                                |
| `delivery.model.js`                | Delivery                                                               |
| `invoice.model.js`                 | Invoice                                                                |
| `marchant.model.js`                | Merchant                                                               |
| `siteInformation.model.js`         | SiteInformation                                                        |
| `outletInformationModel.js`        | OutletInformation                                                      |
| `wishList.model.js`                | Wishlist                                                               |

> **NOTE on Sales model:** `searchItem` still stores `productId` + `variantId`.
> The `color` and `size` fields in searchItem can be deprecated — use `attributes` snapshot going forward.

---

## 9. API Endpoints List

Base URL: `/api/v2`

### Auth

| Method | Endpoint                | Permission |
| ------ | ----------------------- | ---------- |
| POST   | `/auth/register`        | Public     |
| POST   | `/auth/login`           | Public     |
| POST   | `/auth/refresh-token`   | Public     |
| POST   | `/auth/logout`          | Auth       |
| POST   | `/auth/forgot-password` | Public     |
| POST   | `/auth/reset-password`  | Public     |
| POST   | `/auth/verify-email`    | Public     |
| GET    | `/auth/me`              | Auth       |
| PUT    | `/auth/change-password` | Auth       |

### Users (Admin)

| Method | Endpoint                                        | Permission  |
| ------ | ----------------------------------------------- | ----------- |
| GET    | `/users`                                        | manage-user |
| POST   | `/users`                                        | manage-user |
| GET    | `/users/:id`                                    | manage-user |
| PUT    | `/users/:id`                                    | manage-user |
| DELETE | `/users/:id`                                    | manage-user |
| POST   | `/users/:id/roles`                              | manage-user |
| DELETE | `/users/:id/roles/:roleId`                      | manage-user |
| POST   | `/users/:id/permission-overrides`               | manage-user |
| DELETE | `/users/:id/permission-overrides/:permissionId` | manage-user |

### Permissions

| Method | Endpoint             | Permission        |
| ------ | -------------------- | ----------------- |
| POST   | `/permissions`       | manage-permission |
| POST   | `/permissions/bulk`  | manage-permission |
| GET    | `/permissions`       | manage-permission |
| GET    | `/permissions/:slug` | manage-permission |
| PUT    | `/permissions/:slug` | manage-permission |
| DELETE | `/permissions/:slug` | manage-permission |

### Roles

| Method | Endpoint                           | Permission  |
| ------ | ---------------------------------- | ----------- |
| POST   | `/roles`                           | manage-role |
| GET    | `/roles`                           | manage-role |
| GET    | `/roles/:slug`                     | manage-role |
| PUT    | `/roles/:slug`                     | manage-role |
| DELETE | `/roles/:slug`                     | manage-role |
| POST   | `/roles/:slug/permissions`         | manage-role |
| DELETE | `/roles/:slug/permissions/:permId` | manage-role |

### Categories

| Method | Endpoint                       | Permission      |
| ------ | ------------------------------ | --------------- |
| POST   | `/categories`                  | create-category |
| GET    | `/categories`                  | Public          |
| GET    | `/categories/tree`             | Public          |
| GET    | `/categories/roots`            | Public          |
| GET    | `/categories/:slug`            | Public          |
| GET    | `/categories/:slug/children`   | Public          |
| GET    | `/categories/:slug/ancestors`  | Public          |
| PUT    | `/categories/:slug`            | update-category |
| DELETE | `/categories/:slug`            | delete-category |
| PUT    | `/categories/:slug/activate`   | update-category |
| PUT    | `/categories/:slug/deactivate` | update-category |

### Brands

| Method | Endpoint                   | Permission   |
| ------ | -------------------------- | ------------ |
| POST   | `/brands`                  | create-brand |
| GET    | `/brands`                  | Public       |
| GET    | `/brands/:slug`            | Public       |
| PUT    | `/brands/:slug`            | update-brand |
| DELETE | `/brands/:slug`            | delete-brand |
| PUT    | `/brands/:slug/activate`   | update-brand |
| PUT    | `/brands/:slug/deactivate` | update-brand |

### Attribute Definitions

| Method | Endpoint                       | Permission     |
| ------ | ------------------------------ | -------------- |
| POST   | `/attribute-definitions`       | manage-product |
| GET    | `/attribute-definitions`       | Public         |
| GET    | `/attribute-definitions/:slug` | Public         |
| PUT    | `/attribute-definitions/:slug` | manage-product |
| DELETE | `/attribute-definitions/:slug` | manage-product |

### Size Charts

| Method | Endpoint             | Permission     |
| ------ | -------------------- | -------------- |
| POST   | `/size-charts`       | manage-product |
| GET    | `/size-charts`       | Public         |
| GET    | `/size-charts/:slug` | Public         |
| PUT    | `/size-charts/:slug` | manage-product |
| DELETE | `/size-charts/:slug` | manage-product |

### Products

| Method | Endpoint                            | Permission                                             |
| ------ | ----------------------------------- | ------------------------------------------------------ |
| POST   | `/products`                         | create-product                                         |
| GET    | `/products`                         | Public (filter: category, brand, tags, price, inStock) |
| GET    | `/products/search`                  | Public                                                 |
| GET    | `/products/new-arrivals`            | Public                                                 |
| GET    | `/products/best-sellers`            | Public                                                 |
| GET    | `/products/on-discount`             | Public                                                 |
| GET    | `/products/:slug`                   | Public                                                 |
| PUT    | `/products/:slug`                   | update-product                                         |
| DELETE | `/products/:slug`                   | delete-product                                         |
| POST   | `/products/:slug/images`            | update-product                                         |
| DELETE | `/products/:slug/images/:imageId`   | update-product                                         |
| GET    | `/products/:slug/reviews`           | Public                                                 |
| POST   | `/products/:slug/reviews`           | Auth                                                   |
| PUT    | `/products/:slug/reviews/:reviewId` | Auth                                                   |
| DELETE | `/products/:slug/reviews/:reviewId` | Auth                                                   |

### Variants (sub-resource of Product)

| Method | Endpoint                                              | Permission     |
| ------ | ----------------------------------------------------- | -------------- |
| POST   | `/products/:slug/variants`                            | update-product |
| GET    | `/products/:slug/variants`                            | Public         |
| GET    | `/products/:slug/variants/:variantId`                 | Public         |
| PUT    | `/products/:slug/variants/:variantId`                 | update-product |
| DELETE | `/products/:slug/variants/:variantId`                 | update-product |
| PUT    | `/products/:slug/variants/:variantId/activate`        | update-product |
| PUT    | `/products/:slug/variants/:variantId/deactivate`      | update-product |
| POST   | `/products/:slug/variants/:variantId/images`          | update-product |
| DELETE | `/products/:slug/variants/:variantId/images/:imageId` | update-product |
| PUT    | `/products/:slug/variants/:variantId/stock`           | adjust-stock   |

### Discounts

| Method | Endpoint                      | Permission                                        |
| ------ | ----------------------------- | ------------------------------------------------- |
| POST   | `/discounts`                  | manage-discount                                   |
| GET    | `/discounts`                  | manage-discount                                   |
| GET    | `/discounts/:slug`            | manage-discount                                   |
| PUT    | `/discounts/:slug`            | manage-discount                                   |
| DELETE | `/discounts/:slug`            | manage-discount                                   |
| PUT    | `/discounts/:slug/activate`   | manage-discount                                   |
| PUT    | `/discounts/:slug/deactivate` | manage-discount                                   |
| GET    | `/discounts/resolve`          | Public (resolve effective discount for a product) |

### Flash Sales

| Method | Endpoint                           | Permission                          |
| ------ | ---------------------------------- | ----------------------------------- |
| POST   | `/flash-sales`                     | manage-flash-sale                   |
| GET    | `/flash-sales`                     | Public (active only for storefront) |
| GET    | `/flash-sales/live`                | Public (currently running)          |
| GET    | `/flash-sales/upcoming`            | Public                              |
| GET    | `/flash-sales/:slug`               | Public                              |
| PUT    | `/flash-sales/:slug`               | manage-flash-sale                   |
| DELETE | `/flash-sales/:slug`               | manage-flash-sale                   |
| POST   | `/flash-sales/:slug/items`         | manage-flash-sale                   |
| PUT    | `/flash-sales/:slug/items/:itemId` | manage-flash-sale                   |
| DELETE | `/flash-sales/:slug/items/:itemId` | manage-flash-sale                   |

### Banners

| Method | Endpoint         | Permission              |
| ------ | ---------------- | ----------------------- |
| POST   | `/banners`       | manage-content          |
| GET    | `/banners`       | Public (filter by type) |
| GET    | `/banners/:slug` | Public                  |
| PUT    | `/banners/:slug` | manage-content          |
| DELETE | `/banners/:slug` | manage-content          |

### (All other v1 routes remain — orders, cart, wishlist, purchase, sales, customer, supplier, employee, etc.)

---

## 10. Database Indexes

```js
// ── Category ──────────────────────────────────────────────────────────────
{ slug: 1 }           // unique
{ parent: 1 }         // tree traversal + children lookup
{ isActive: 1 }

// ── Brand ─────────────────────────────────────────────────────────────────
{ slug: 1 }           // unique
{ isActive: 1 }

// ── AttributeDefinition ───────────────────────────────────────────────────
{ slug: 1 }           // unique

// ── SizeChart ────────────────────────────────────────────────────────────
{ slug: 1 }           // unique
{ category: 1 }       // category-level lookup

// ── Product ───────────────────────────────────────────────────────────────
{ slug: 1 }                                         // unique
{ category: 1, brand: 1, isActive: 1 }             // catalog filter
{ "variants.sku": 1 }                               // SKU lookup (POS)
{ "variants.barCode": 1 }                           // barcode scan
{ name: "text", "variants.sku": "text", "variants.barCode": "text" } // full-text search
{ totalSales: -1 }                                  // best-sellers
{ createdAt: -1 }                                   // new arrivals
{ isDeleted: 1, isActive: 1 }

// ── Discount ──────────────────────────────────────────────────────────────
{ validFrom: 1, validTo: 1, isActive: 1 }                        // active discount query
{ scope: 1, isActive: 1 }
{ categories: 1 }                                                 // category discount lookup
{ brands: 1 }                                                     // brand discount lookup
{ products: 1 }                                                   // product discount lookup
{ "variants.product": 1, "variants.variantId": 1 }               // variant-level lookup
{ priority: -1 }                                                  // priority sort

// ── FlashSale ─────────────────────────────────────────────────────────────
{ isActive: 1, startAt: 1, endAt: 1 }              // live flash sale query
{ "items.product": 1, "items.variantId": 1 }       // item lookup

// ── Permission ────────────────────────────────────────────────────────────
{ slug: 1 }           // unique
{ module: 1 }         // group by module in admin UI

// ── Role ──────────────────────────────────────────────────────────────────
{ slug: 1 }           // unique
{ isActive: 1 }

// ── User ──────────────────────────────────────────────────────────────────
{ email: 1 }          // unique
{ phone: 1, sparse: true }
{ roles: 1 }

// ── Banner ────────────────────────────────────────────────────────────────
{ type: 1, isActive: 1 }                           // fetch by type for storefront
{ priority: -1 }

// ── Cart ──────────────────────────────────────────────────────────────────
{ user: 1 }                                        // logged-in user cart lookup
{ guestId: 1 }                                     // guest cart lookup
{ expiresAt: 1 }, expireAfterSeconds: 0            // TTL — MongoDB auto-deletes guest carts
```

---

## 11. Design Decisions Summary

| Decision                  | Choice                                                     | Reason                                                         |
| ------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Category hierarchy        | Self-referential `parent: null = root`                     | Amazon/Daraz style, unlimited depth, simple                    |
| Brand ↔ Category          | Independent, product refs both                             | Samsung spans Electronics + Appliances                         |
| Variant storage           | Embedded array in Product                                  | Atomic updates, single doc fetch, <16MB for typical product    |
| Variant attributes        | `[{key, value:Mixed}]`                                     | Free-form dynamic, driven by AttributeDefinition in UI         |
| SizeChart                 | Template (data table, columns + rows)                      | Reusable across products, structured not an image              |
| SizeChart scope           | Category-level template, Product can override              | Inheritance: Product → Category                                |
| Discount scope            | 5-level: variant → product → brand → category → all        | Daraz/Shopee-style precision — variant SKU level targeting     |
| Discount conditions       | minOrderAmount, minQuantity, customerSegment               | Conditional promotions ("৳1000+ কিনলে 15% off")                |
| Discount limits           | usageLimit + usageCount + budgetCap + budgetUsed           | Budget-controlled campaigns, prevents unlimited spend          |
| Discount stacking         | Granular: withCoupon, withFlashSale, withOtherDiscount     | Fine-grained control vs single boolean                         |
| Discount resolution       | Priority cascade + level hierarchy + tie-breaking          | Predictable, no ambiguity — highest level wins first           |
| Discount type fixed_price | Added "fixed_price" alongside percentage/fixed             | "Always ৳499" Daraz-style hard price override                  |
| FlashSale                 | Separate model with per-item stock cap                     | Different semantics from discount: countdown + qty limit       |
| Banner                    | Single model with `type` enum                              | Eliminates duplicate schema, simpler API                       |
| Permission model          | Keep existing style, add module+action fields              | Matches your existing code style                               |
| Role                      | Upgraded: now carries `permissions[]`                      | Standard RBAC: Role = permission bundle                        |
| SuperAdmin                | `isSuperAdmin` flag on User (hidden field)                 | Not deletable as a role, survives role cleanup                 |
| Permission override       | `{permission, type: grant                                  | deny}` on User                                                 | Least-privilege: deny wins, fine-grained control |
| Cart identity             | `user` OR `guestId` — never both simultaneously            | Clean separation, merge on login                               |
| Cart guest TTL            | `expiresAt` + MongoDB TTL index (7-day sliding)            | Auto-cleanup abandoned guest carts, no cron job needed         |
| Cart item variant ref     | `variantId: ObjectId` (embedded \_id) — NOT collection ref | v2 has no Variant collection, variants live in Product         |
| Cart item attributes      | `[{key,value}]` dynamic, replaces `color`+`size` strings   | Matches v2 variant attribute design                            |
| Cart item snapshot        | productName, variantName, sku, image stored on add         | Display cart without re-fetching Product                       |
| Cart price source         | Always `variant.pricing.retailPrice` from server           | Client-sent price never trusted — prevents manipulation        |
| Cart discount snapshot    | `originalPrice` + `appliedDiscount` per item               | Strikethrough price + badge without re-running discount engine |
| Cart price staleness      | `priceUpdatedAt` — refreshed on cart GET if price changed  | Frontend shows "Price changed" warning before checkout         |
| Cart stock visibility     | `stockStatus` enum per item, refreshed on cart GET         | "Out of Stock" badge in cart, checkout disabled proactively    |
| Cart/Order items          | `variantId` + attribute snapshot                           | Snapshots = immutable order history, no join on display        |
| Purchase line items       | `variantId` + full snapshot                                | Audit trail: what was bought at what price/spec                |
| Soft delete               | `isDeleted + deletedAt` on Product, User                   | Preserves order/purchase history references                    |
| Subcategory removal       | ✓ Removed — self-referential category handles this         | No duplication, cleaner tree                                   |
| UserPermission collection | ✓ Removed — merged into User model                         | Was redundant with User.permissions[]                          |
| discountBanner model      | ✓ Removed — merged into Banner with type field             | Identical schema, no need for two collections                  |

---

_Generated by Claude Code — zCommerce v2 Architecture_
