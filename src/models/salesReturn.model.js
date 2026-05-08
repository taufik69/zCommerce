const mongoose = require("mongoose");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

const salesReturnSchema = new mongoose.Schema(
  {
  
    invoiceNumber: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Sales",
      required: true,
      index:true,
    },
    refundMethod: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    returnReason: {
      type: String,
      trim: true,
      required: true,
    },
    allproduct: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        unitPrice: {
          type: Number,
          required: true,
        },
        subtotal: {
          type: Number,
          required: true,
        },
      },
    ],
    totalReturnAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    remarks: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);



// Duplicate check hook for invoiceNumber (redundant due to unique:true but good for custom error)
salesReturnSchema.pre("save", async function (next) {
  try {
    if (this.isModified("invoiceNumber")) {
      const existing = await this.constructor.findOne({
        invoiceNumber: this.invoiceNumber,
        _id: { $ne: this._id },
      });
      if (existing) {
        return next(
          new customError(
            `SalesReturn with invoice number ${this.invoiceNumber} already exists`,
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

const SalesReturn =
  mongoose.models.SalesReturn ||
  mongoose.model("SalesReturn", salesReturnSchema);

module.exports = SalesReturn;
