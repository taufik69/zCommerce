const mongoose = require("mongoose");

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

module.exports =
  mongoose.models.EmployeeAdvancePayment ||
  mongoose.model("EmployeeAdvancePayment", employeeAdvancePaymentSchema);
