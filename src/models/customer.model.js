const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");

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
      type: String,
      trim: true,
      default: "",
      // example enum if you want:
      // enum: ["regular", "wholesale", "vip", ""],
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
  const Customer = this.constructor;

  // check customerId
  if (this.customerId) {
    const existingById = await Customer.findOne({
      customerId: this.customerId,
    });
    if (existingById && existingById._id.toString() !== this._id.toString()) {
      throw new customError(
        `Customer with ID ${this.customerId} already exists`,
        400,
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
      throw new customError(
        `Customer with mobile ${this.mobileNumber} already exists`,
        400,
      );
    }
  }

  next();
});

const customerModel = mongoose.model("Customer", customerSchema);
module.exports = { customerModel };
