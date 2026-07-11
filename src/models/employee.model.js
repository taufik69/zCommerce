const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const Counter = require("./counter.model");
const { statusCodes } = require("../constant/constant");

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

const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },

    nidNumber: { type: String, trim: true },

    designation: {
      type: mongoose.Types.ObjectId,
      ref: "EmployeeDesignation",
    },

    deapartment: {
      type: mongoose.Types.ObjectId,
      ref: "Department",
      default: null,
    },

    section: {
      type: mongoose.Types.ObjectId,
      ref: "Section",
      default: null,
    },

    educationalQualification: { type: String, trim: true },
    dateOfBirth: { type: Date },

    gender: {
      type: String,
      required: [true, "Gender is required"],
      trim: true,
      enum: ["male", "female", "other"],
    },

    religion: { type: String, trim: true },
    bloodGroup: { type: String, trim: true },
    nationality: { type: String, trim: true },
    fathersName: { type: String, trim: true },
    mothersName: { type: String, trim: true },

    mobile: { type: String, trim: true, unique: true },
    secondaryMobile: { type: String, trim: true },

    image: {
      type: imageSchema,
      default: () => ({}),
    },

    email: { type: String, trim: true, lowercase: true },
    presentAddress: { type: String, trim: true },
    permanentAddress: { type: String, trim: true },

    joiningDate: { type: Date },

    referencePersonName: { type: String, trim: true },
    referencePersonDetails: { type: String, trim: true },
    referenceMobile: { type: String, trim: true },

    salary: {
      basicSalary: { type: Number, default: 0, min: 0 },
      houseRent: { type: Number, default: 0, min: 0 },
      medicalAllowance: { type: Number, default: 0, min: 0 },
      othersAllowance: { type: Number, default: 0, min: 0 },
      specialAllowance: { type: Number, default: 0, min: 0 },
      providentFund: { type: Number, default: 0, min: 0 },
      grossSalary: { type: Number, default: 0, min: 0 },
      netSalary: { type: Number, default: 0, min: 0 },
    },

    certifications: [
      {
        title: { type: String, trim: true },
        institute: { type: String, trim: true },
        year: { type: String, trim: true },
        details: { type: String, trim: true },
        image: {
          type: imageSchema,
          default: () => ({}),
        },
      },
    ],

    comments: { type: String, trim: true, maxlength: 500 },

    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Prevent manual employeeId on create
employeeSchema.pre("save", async function (next) {
  try {
    const emp = this;
    if (emp.isModified("employeeId") && emp.employeeId) {
      const existing = await mongoose.model("Employee").findOne({
        employeeId: emp.employeeId,
        _id: { $ne: emp._id },
      });
      if (existing) {
        return next(
          new customError("Employee ID already exists", statusCodes.BAD_REQUEST),
        );
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Auto-generate employeeId after first save
employeeSchema.post("save", async function (doc, next) {
  try {
    if (doc.employeeId) return next();

    const counter = await Counter.findOneAndUpdate(
      { key: "EMPLOYEE" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const padded = String(counter.seq).padStart(5, "0");
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { employeeId: `EMP-${padded}` } },
    );
    next();
  } catch (error) {
    next(error);
  }
});

// Duplicate key handler
employeeSchema.post("save", function (error, doc, next) {
  if (error && error.code === 11000) {
    const field =
      (error.keyPattern && Object.keys(error.keyPattern)[0]) ||
      (error.keyValue && Object.keys(error.keyValue)[0]) ||
      "field";
    return next(new customError(`${field} already exists`, statusCodes.BAD_REQUEST));
  }
  return next(error);
});

// Calculate gross and net salary before save
employeeSchema.pre("save", function (next) {
  try {
    const { basicSalary = 0, houseRent = 0, medicalAllowance = 0, othersAllowance = 0, specialAllowance = 0, providentFund = 0 } = this.salary;
    this.salary.grossSalary =
      basicSalary + houseRent + medicalAllowance + othersAllowance + specialAllowance;
    this.salary.netSalary = this.salary.grossSalary - providentFund;
    next();
  } catch (error) {
    next(error);
  }
});

module.exports =
  mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
