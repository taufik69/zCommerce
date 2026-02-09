const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const { default: slugify } = require("slugify");
const customerTypeSchema = mongoose.Schema({
  customerType: {
    type: String,
    trim: true,
    default: "",
    // example enum if you want:
    // enum: ["regular", "wholesale", "vip", ""],
  },
  slug: {
    type: String,
  },
});

// make a slug
customerTypeSchema.pre("save", function (next) {
  if (this.isModified("customerType")) {
    this.slug = slugify(this.customerType, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

// check if slug already exist or not
customerTypeSchema.pre("save", async function (next) {
  try {
    const existing = await this.constructor.findOne({ slug: this.slug });
    if (existing && existing._id.toString() !== this._id.toString()) {
      return next(
        new customError(
          `Customer type with name "${this.customerType}" already exists`,
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

//when findoneandupdate then update the slug
customerTypeSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.customerType) {
    update.slug = slugify(update.customerType, {
      lower: true,
      strict: true,
      trim: true,
    });
  }
  next();
});

const CustomerType =
  mongoose.models.CustomerType ||
  mongoose.model("CustomerType", customerTypeSchema);

// customer model

const customerSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      trim: true,
      unique: true,
      index: true,
      // auto set from mobileNumber in pre-save if empty
    },

    customerType: {
      type: mongoose.Types.ObjectId,
      ref: "CustomerType",
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    mobileNumber: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      unique: true,
      index: true,
      validate: {
        validator: function (v) {
          // BD mobile example: 01XXXXXXXXX (11 digits) or +8801XXXXXXXXX
          return /^(01\d{9}|\+8801\d{9})$/.test(v);
        },
        message: "Invalid mobile number format",
      },
    },

    occupation: {
      type: String,
      trim: true,
      default: "",
    },

    nidNumber: {
      type: String,
      trim: true,
      default: "",
      // if you want validation:
      // validate: { validator: v => !v || /^\d{10}|\d{13}|\d{17}$/.test(v), message: "Invalid NID" }
    },

    openingDues: {
      type: Number,
      default: 0,
      min: [0, "Opening dues cannot be negative"],
    },

    regularDiscountPercent: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
      max: [100, "Discount cannot be more than 100"],
    },

    emailAddress: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      validate: {
        validator: function (v) {
          if (!v) return true; // optional
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: "Invalid email address",
      },
    },

    image: {
      type: String,
      trim: true,
      default: "",
      // store Cloudinary URL or file URL
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    presentAddress: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    permanentAddress: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

/**
 * Auto set customerId = mobileNumber (your UI says "Enter Mobile Number As ID")
 */
customerSchema.pre("save", function (next) {
  if (!this.customerId && this.mobileNumber) {
    this.customerId = this.mobileNumber;
  }
  next();
});

/**
 * Uniqueness check with customError (same style as your Brand model)
 * - customerId unique
 * - mobileNumber unique
 */
customerSchema.pre("save", async function (next) {
  try {
    const Customer = this.constructor;

    // check customerId
    if (this.customerId) {
      const existingById = await Customer.findOne({
        customerId: this.customerId,
      });
      if (existingById && existingById._id.toString() !== this._id.toString()) {
        return next(
          new customError(
            `Customer with ID ${this.customerId} already exists`,
            statusCodes.BAD_REQUEST,
          ),
        );
      }
    }

    // check mobileNumber
    if (this.mobileNumber) {
      const existingByMobile = await Customer.findOne({
        mobileNumber: this.mobileNumber,
      });
      if (
        existingByMobile &&
        existingByMobile._id.toString() !== this._id.toString()
      ) {
        return next(
          new customError(
            `Customer with mobile ${this.mobileNumber} already exists`,
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

const customerModel =
  mongoose.models.Customer || mongoose.model("Customer", customerSchema);

// customer payment recived model schema

const customerPaymentRecivedSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Customer id is required"],
      trim: true,
      ref: "Customer",
    },

    referenceInvoice: {
      type: String,
      trim: true,
      default: "",
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lessAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    cashBack: {
      type: Number,
      default: 0,
      min: 0,
    },

    date: {
      type: Date,
    },

    paymentMode: {
      type: String,
      trim: true,
      default: "",
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const customerPaymentRecived =
  mongoose.models.CustomerPaymentRecived ||
  mongoose.model("CustomerPaymentRecived", customerPaymentRecivedSchema);

// advance customer payment

const customerAdvancePaymentSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Customer name is required"],
      trim: true,
      ref: "Customer",
    },

    // form shows current balance (optional store)
    balance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },

    paidAmount: {
      type: Number,
      min: [0, "Paid amount cannot be negative"],
    },

    advanceCashBack: {
      type: Number,
      default: 0,
      min: [0, "Advance cash back cannot be negative"],
    },

    paymentMode: {
      type: String,
      trim: true,
    },

    date: {
      type: Date,
    },

    remarks: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

const customerAdvancePaymentModel =
  mongoose.models.CustomerAdvancePayment ||
  mongoose.model("CustomerAdvancePayment", customerAdvancePaymentSchema);

module.exports = {
  CustomerType,
  customerModel,
  customerPaymentRecived,
  customerAdvancePaymentModel,
};
