const mongoose = require("mongoose");
const { default: slugify } = require("slugify");
const { customError } = require("../lib/CustomError");

const employeeAdvancePaymentSchema = new mongoose.Schema(
  {
    // Form: Date
    date: {
      type: Date,
      required: [true, "Date is required"],
      default: Date.now,
    },

    /**
     * Form: Month*
     * Best: store month key like "2026-01" (YYYY-MM)
     */
    month: {
      type: String,
      required: [true, "Month is required"],
      trim: true,
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, "Month must be in YYYY-MM format"],
      index: true,
    },

    // Form: Employee ID*
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      trim: true,
      index: true,
    },

    // Form: Amount*
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [1, "Amount must be greater than 0"],
    },

    balanceAmount: {
      type: Number,
      min: [0, "Balance amount cannot be negative"],
    },

    // Form: Payment Mode (dropdown)
    paymentMode: {
      type: String,
      trim: true,
      enum: {
        values: ["cash", "bank", "bkash", "nagad", "rocket", "cheque", "other"],
        message:
          "Payment mode must be cash, bank, bkash, nagad, rocket, cheque, or other",
      },
      default: "cash",
    },

    // Form: Remarks
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },

    // Optional: Soft delete + status
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

// check  same emplyee take advancew payment in same month prevent before save the save
// employeeAdvancePaymentSchema.pre("save", async function (next) {
//   const existingAdvancePayment = await this.constructor.findOne({
//     employeeId: this.employeeId,
//     month: this.month,
//   });
//   if (existingAdvancePayment) {
//     throw new Error("Employee already took advance payment in this month");
//   }
//   next();
// });
const employeeAdvancePayment =
  mongoose.models.EmployeeAdvancePayment ||
  mongoose.model("EmployeeAdvancePayment", employeeAdvancePaymentSchema);

// want to make employee designation model

const employeeDesignationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Designation name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// make a slug using name
employeeDesignationSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

// check this slug is alreay exist
employeeDesignationSchema.pre("save", async function (next) {
  try {
    const existingDesignation = await this.constructor.findOne({
      slug: this.slug,
    });
    if (
      existingDesignation &&
      existingDesignation._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          `Designation with slug ${this.slug} already exists`,
          400,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// when update name then update slug also
employeeDesignationSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true });
  }
  next();
});

const employeeDesignationModel =
  mongoose.models.EmployeeDesignation ||
  mongoose.model("EmployeeDesignation", employeeDesignationSchema);

// department model

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// make a slug using name
departmentSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true });
  }
  next();
});

// check this slug is alreay exist
departmentSchema.pre("save", async function (next) {
  try {
    const existingDepartment = await this.constructor.findOne({
      slug: this.slug,
    });
    if (
      existingDepartment &&
      existingDepartment._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(
          `Department with slug ${this.slug} already exists`,
          400,
        ),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// when update name then update slug also
departmentSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true });
  }
  next();
});

const departmentModel =
  mongoose.models.Department || mongoose.model("Department", departmentSchema);

// same to same  make a model section model like department model
const sectionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Section name is required"],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// make a slug using name
sectionSchema.pre("save", function (next) {
  if (this.isModified("name")) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// check this slug is alreay exist
sectionSchema.pre("save", async function (next) {
  try {
    const existingSection = await this.constructor.findOne({
      slug: this.slug,
    });
    if (
      existingSection &&
      existingSection._id.toString() !== this._id.toString()
    ) {
      return next(
        new customError(`Section with slug ${this.slug} already exists`, 400),
      );
    }
    next();
  } catch (error) {
    next(error);
  }
});

// when update name then update slug also
sectionSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();
  if (update.name) {
    update.slug = slugify(update.name, { lower: true });
  }
  next();
});

const sectionModel =
  mongoose.models.Section || mongoose.model("Section", sectionSchema);

module.exports = {
  employeeDesignationModel,
  employeeAdvancePayment,
  departmentModel,
  sectionModel,
};
