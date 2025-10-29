const mongoose = require("mongoose");

const purchaseSchema = new mongoose.Schema(
  {
    invoiceNumber: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },
    date: {
      type: Date,
      default: Date.now,
    },
    supplierName: {
      type: String,
      trim: true,
      required: true,
    },
    cashType: {
      type: String,
      // enum: ["cash", "bank", "mobile_banking"],
      // required: true,
    },

    // inline product schema
    allproduct: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        variant: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Variant",
        },

        purchasePrice: {
          type: Number,
        },
        retailPrice: {
          type: Number,
        },
        subTotal: {
          type: Number,
          default: 0,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        size: {
          type: String,
          trim: true,
        },
        color: {
          type: String,
          trim: true,
        },
      },
    ],

    subTotal: {
      type: Number,
      default: 0,
    },
    commission: {
      type: Number,
      default: 0,
    },
    shipping: {
      type: Number,
      default: 0,
    },
    payable: {
      type: Number,
      default: 0,
    },
    dueamount: {
      type: Number,
      default: 0,
    },
    paid: {
      type: Number,
      default: 0,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    subCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
    },
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },
  },
  { timestamps: true }
);

purchaseSchema.pre("save", async function (next) {
  const existingInvoiceNumber = await this.constructor.findOne({
    invoiceNumber: this.invoiceNumber,
  });
  if (
    existingInvoiceNumber &&
    existingInvoiceNumber._id.toString() !== this._id.toString()
  ) {
    console.log(`Invoice Number ${this.invoiceNumber} already exists`);
    throw new Error("Invoice Number already exists");
  }
  next();
});
// check invoiceid is unique or not
purchaseSchema.index({ invoiceNumber: 1 }, { unique: true });
const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
