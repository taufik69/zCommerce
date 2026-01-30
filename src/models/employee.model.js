const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const Counter = require("./counter.model");
const employeeSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },

    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"],
      maxlength: [100, "Full name cannot exceed 100 characters"],
    },

    nidNumber: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },

    designation: {
      type: String,
      required: [true, "Designation is required"],
      trim: true,
    },

    educationalQualification: {
      type: String,
      trim: true,
      required: [true, "Educational qualification is required"],
    },
    dateOfBirth: { type: Date, required: [true, "Date of birth is required"] },

    gender: {
      type: String,
      required: [true, "Gender is required"],
      trim: true,
      enum: ["male", "female", "other"],
    },

    religion: { type: String, trim: true },
    bloodGroup: {
      type: String,
      trim: true,
      required: [false, "Blood group is required"],
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },

    nationality: { type: String, trim: true },
    fathersName: { type: String, trim: true },
    mothersName: { type: String, trim: true },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      unique: true,
      index: true,
    },

    secondaryMobile: { type: String, trim: true },
    image: { type: String, trim: true },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

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
    },

    comments: { type: String, trim: true, maxlength: 500 },

    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    department: { type: String, trim: true },
    section: { type: String, trim: true },
  },
  { timestamps: true },
);

// before save check the employeeid is duplicate or not
employeeSchema.pre("save", async function (next) {
  const emp = this;
  if (emp.isModified("employeeId") && emp.employeeId) {
    const existing = await mongoose
      .model("Employee")
      .findOne({ employeeId: emp.employeeId, _id: { $ne: emp._id } });
    if (existing) {
      return next(new customError(400, "employeeId already exists"));
    }
  }
  next();
});
/**
 * - employeeId manually set
 */
employeeSchema.post("save", async function (doc, next) {
  try {
    //  already set থাকলে আবার run করবে না
    if (doc.employeeId) return next();

    //  atomic counter
    const counter = await Counter.findOneAndUpdate(
      { key: "EMPLOYEE" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true },
    );

    const padded = String(counter.seq).padStart(5, "0");
    const employeeId = `EMP-${padded}`;

    // update same document (NO recursion)
    await doc.constructor.updateOne({ _id: doc._id }, { $set: { employeeId } });

    next();
  } catch (error) {
    next(error);
  }
});
/**
 * (MongoDB duplicate key error -> 11000)
 */
employeeSchema.post("save", function (error, doc, next) {
  if (error && error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0] || "field";
    return next(new customError(400, `${field} already exists`));
  }
  next(error);
});

module.exports =
  mongoose.models.Employee || mongoose.model("Employee", employeeSchema);
