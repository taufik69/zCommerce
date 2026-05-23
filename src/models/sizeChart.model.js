const mongoose = require("mongoose");
const slugify = require("slugify");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// Column subdocument schema for size chart table headers
const columnSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: [true, "Column key is required"],
      lowercase: true,
      match: [/^[a-z0-9_]+$/, "Column key must be lowercase alphanumeric"],
    },
    label: {
      type: String,
      required: [true, "Column label is required"],
      trim: true,
    },
    unit: {
      type: String,
      enum: ["inch", "cm", "mm", "kg", "lbs", "ml", "l", "unitless"],
      default: "unitless",
    },
    order: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      maxlength: 500,
    },
  },
  { _id: false },
);

// Row subdocument schema for size chart data rows
const rowSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: [true, "Size label is required"],
      trim: true,
    },
    values: [
      {
        type: String,
        required: true,
      },
    ],
    order: {
      type: Number,
      default: 0,
    },
    sku: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);


const sizeChartSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Size chart name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
    },
    description: {
      type: String,
      maxlength: 1000,
    },

    // Hierarchical targeting: which level this chart applies to
    applicableLevel: {
      type: String,
      enum: {
        values: ["category", "subCategory", "product", "variant", "brand"],
        message:
          "Applicable level must be one of: category, subCategory, product, variant, brand",
      },
      required: [true, "Applicable level is required"],
    },

    // References for multi-level targeting (one will be populated based on applicableLevel)
    applicableCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    applicableSubCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory",
      },
    ],
    applicableProducts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    applicableVariants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Variant",
      },
    ],
    applicableBrands: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand",
      },
    ],

    // Table structure: columns and rows defining the size chart
    columns: {
      type: [columnSchema],
      required: [true, "At least one column is required"],
      validate: {
        validator: function (v) {
          return v.length >= 1 && v.length <= 10;
        },
        message: "Size chart must have between 1 and 10 columns",
      },
    },
    rows: {
      type: [rowSchema],
      required: [true, "At least one row is required"],
      validate: {
        validator: function (v) {
          return v.length >= 1;
        },
        message: "Size chart must have at least one row (size)",
      },
    },

    // Auto-populated from rows for quick access
    sizeLabels: [String],
    minSize: String,
    maxSize: String,

    // Video support for demonstration
    videoUrl: {
      type: String,
      validate: {
        validator: function (v) {
          if (!v) return true;
          return /^https?:\/\/.+/.test(v);
        },
        message: "Video URL must be a valid HTTP/HTTPS URL",
      },
    },

    // Display and visibility
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    visibility: {
      type: String,
      enum: ["public", "internal", "draft"],
      default: "draft",
    },

    // Tracking
    viewCount: {
      type: Number,
      default: 0,
    },
    // Metadata
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Generate slug from name
sizeChartSchema.pre("save", async function (next) {
  try {
    if (this.isModified("name")) {
      this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Ensure row.values length matches columns.length
sizeChartSchema.pre("save", function (next) {
  try {
    if (this.columns && this.rows) {
      const columnCount = this.columns.length;
      for (const row of this.rows) {
        if (row.values.length !== columnCount) {
          return next(
            new customError(
              `Row "${row.label}" has ${row.values.length} values but expected ${columnCount} (number of columns)`,
              statusCodes.BAD_REQUEST,
            ),
          );
        }
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Populate sizeLabels, minSize, maxSize from rows
sizeChartSchema.pre("save", function (next) {
  try {
    if (this.rows && this.rows.length > 0) {
      this.sizeLabels = this.rows.map((r) => r.label);
      this.minSize = this.rows[0].label;
      this.maxSize = this.rows[this.rows.length - 1].label;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Sort columns and rows by order field
sizeChartSchema.pre("save", function (next) {
  try {
    if (this.columns) {
      this.columns.sort((a, b) => a.order - b.order);
    }
    if (this.rows) {
      this.rows.sort((a, b) => a.order - b.order);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Validate that applicableLevel has corresponding references
sizeChartSchema.pre("save", function (next) {
  try {
    let applicableArray;
    switch (this.applicableLevel) {
      case "category":
        applicableArray = this.applicableCategories;
        break;
      case "subCategory":
        applicableArray = this.applicableSubCategories;
        break;
      case "product":
        applicableArray = this.applicableProducts;
        break;
      case "variant":
        applicableArray = this.applicableVariants;
        break;
      case "brand":
        applicableArray = this.applicableBrands;
        break;
    }

    if (!applicableArray || applicableArray.length === 0) {
      return next(
        new customError(
          `At least one applicable ${this.applicableLevel} is required`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Check slug uniqueness (excluding current document)
sizeChartSchema.pre("save", async function (next) {
  try {
    const existingSizeChart = await this.constructor.findOne({
      slug: this.slug,
      _id: { $ne: this._id },
    });
    if (existingSizeChart) {
      return next(
        new customError(
          `SizeChart with slug "${this.slug}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Indexes for performance
sizeChartSchema.index({ slug: 1 });
sizeChartSchema.index({ isActive: 1, visibility: 1 });
sizeChartSchema.index({ applicableLevel: 1, isActive: 1 });
sizeChartSchema.index({ applicableCategories: 1 });
sizeChartSchema.index({ applicableSubCategories: 1 });
sizeChartSchema.index({ applicableProducts: 1 });
sizeChartSchema.index({ applicableVariants: 1 });
sizeChartSchema.index({ createdAt: -1, updatedAt: -1 });

// Instance methods
sizeChartSchema.methods.getTableHTML = function () {
  if (!this.columns || !this.rows) return "";

  let html = '<table class="size-chart"><thead><tr>';
  this.columns.forEach((col) => {
    html += `<th>${col.label}${col.unit ? ` (${col.unit})` : ""}</th>`;
  });
  html += "</tr></thead><tbody>";

  this.rows.forEach((row) => {
    html += `<tr><td>${row.label}</td>`;
    row.values.forEach((val) => {
      html += `<td>${val}</td>`;
    });
    html += "</tr>";
  });

  html += "</tbody></table>";
  return html;
};

sizeChartSchema.methods.getSizeMeasurements = function (sizeLabel) {
  const row = this.rows?.find((r) => r.label === sizeLabel);
  if (!row) return null;

  const measurements = {};
  this.columns?.forEach((col, idx) => {
    measurements[col.key] = {
      value: row.values[idx],
      unit: col.unit,
      label: col.label,
    };
  });

  return measurements;
};

sizeChartSchema.methods.hasSizeLabel = function (sizeLabel) {
  return this.sizeLabels?.includes(sizeLabel) || false;
};

sizeChartSchema.methods.getColumn = function (key) {
  return this.columns?.find((c) => c.key === key) || null;
};


sizeChartSchema.methods.incrementViewCount = async function () {
  return await this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { viewCount: 1 } },
    { new: true },
  );
};


// Static methods
sizeChartSchema.statics.getApplicableCharts = async function (filters) {
  const query = {
    isActive: true,
    visibility: { $ne: "draft" },
  };

  if (filters.categoryId) {
    query.applicableLevel = "category";
    query.applicableCategories = filters.categoryId;
  }

  if (filters.subCategoryId) {
    query.applicableLevel = "subCategory";
    query.applicableSubCategories = filters.subCategoryId;
  }

  if (filters.productId) {
    query.applicableLevel = "product";
    query.applicableProducts = filters.productId;
  }

  if (filters.variantId) {
    query.applicableLevel = "variant";
    query.applicableVariants = filters.variantId;
  }

  if (filters.brandId) {
    query.applicableLevel = "brand";
    query.applicableBrands = filters.brandId;
  }

  return await this.find(query).sort({ displayOrder: 1 });
};


module.exports =
  mongoose.models.SizeChart || mongoose.model("SizeChart", sizeChartSchema);
