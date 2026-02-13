const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const supplierSchema = new mongoose.Schema(
  {
    // Supplier ID * (you said: mobile # as ID)
    supplierId: {
      type: String,
      required: [true, "Supplier ID is required"],
      trim: true,
      unique: true,
      index: true,
      match: [/^(?:\+?88)?01[3-9]\d{8}$/, "Invalid mobile number"],
    },

    // Supplier Name *
    supplierName: {
      type: String,
      required: [true, "Supplier Name is required"],
      trim: true,
      minlength: [2, "Supplier Name must be at least 2 characters"],
      maxlength: [120, "Supplier Name cannot exceed 120 characters"],
    },

    // Contact Person Name (optional)
    contactPersonName: {
      type: String,
      trim: true,
      maxlength: [80, "Contact Person Name cannot exceed 80 characters"],
      default: "",
    },

    // Contact Person Designation (optional)
    contactPersonDesignation: {
      type: String,
      trim: true,
      maxlength: [80, "Designation cannot exceed 80 characters"],
      default: "",
    },

    // Mobile (optional, but recommended)
    mobile: {
      type: String,
      trim: true,
      default: "",
    },

    // Supplier Address (optional)
    supplierAddress: {
      type: String,
      trim: true,
      maxlength: [300, "Address cannot exceed 300 characters"],
    },

    // Opening Dues (optional)
    openingDues: {
      type: Number,
      default: 0,
      min: [0, "Opening dues cannot be negative"],
    },

    // Status + Soft delete
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Ensure supplierId unique (DB level)
supplierSchema.index({ supplierId: 1 }, { unique: true });

// pre-save duplicate check (like your Purchase model)
supplierSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({
      supplierId: this.supplierId,
    });

    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Supplier with supplierId ${this.supplierId} already exists.`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    next();
  } catch (error) {
    next(error);
  }
});

const SupplierModel =
  mongoose.models.Supplier || mongoose.model("Supplier", supplierSchema);

//
const supplierDuePaymentSchema = new mongoose.Schema(
  {
    // Transaction ID (auto generate)
    transactionId: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "Transaction ID is required"],
    },

    // Date
    date: {
      type: Date,
      default: Date.now,
      required: true,
    },

    // Supplier info
    supplierId: {
      type: mongoose.Types.ObjectId,
      required: [true, "Supplier ID is required"],
      index: true,
      ref: "Supplier ",
    },

    // Paid Amount *
    paidAmount: {
      type: Number,
      required: [true, "Paid amount is required"],
      min: [0, "Paid amount cannot be negative"],
    },

    // Less Amount (discount/adjustment)
    lessAmount: {
      type: Number,
      default: 0,
      min: [0, "Less amount cannot be negative"],
    },

    // Payment Mode *
    paymentMode: {
      type: mongoose.Types.ObjectId,
      ref: "Account",
      required: [true, "Payment mode is required"],
    },

    // Remarks
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      default: "",
    },

    // Optional: after payment due snapshot
    remainingDue: {
      type: Number,
      default: 0,
      min: [0, "Remaining due cannot be negative"],
    },

    // Status + Soft delete
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    updatedAt: {
      type: Date,
    },
  },
  { timestamps: true },
);

// Auto-generate Transaction ID
supplierDuePaymentSchema.pre("validate", function (next) {
  if (!this.transactionId) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const rand = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
    this.transactionId = `STID-${y}${m}${day}-${rand}`;
  }
  next();
});

const SupplierDuePayment =
  mongoose.models.SupplierDuePayment ||
  mongoose.model("SupplierDuePayment", supplierDuePaymentSchema);
module.exports = { SupplierModel, SupplierDuePayment };
