require("dotenv").config();
const mongoose = require("mongoose");

/** -------------------------
 * Sub Schemas
 * ------------------------*/

// walking customer (embedded)
const walkingCustomerSchema = new mongoose.Schema(
  {
    customerName: { type: String, trim: true },
    mobileNumber: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
  },
  { _id: false },
);

// listed customer (embedded ref)
const listedCustomerSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  },
  { _id: false },
);

// searchItem (embedded array)
const searchItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },

    salesStatus: {
      type: String,
      enum: ["sale", "return"],
    },

    barcode: { type: String, trim: true },
    productDescription: { type: String, trim: true },

    color: { type: String, trim: true },
    size: { type: String, trim: true },

    quantity: { type: Number, default: 1, min: 0 },
    groupQuantity: { type: Number, default: 0, min: 0 },

    salesRate: { type: Number, default: 0, min: 0 },
    discount: { type: Number, default: 0, min: 0 },

    subtotal: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

// payments (embedded)
const singlePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    paymentTo: { type: String, trim: true },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const multiplePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    paymentTo: { type: String, trim: true },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const paymentMethodSchema = new mongoose.Schema(
  {
    singlePayment: { type: singlePaymentSchema, default: null },
    multiplePayment: { type: [multiplePaymentSchema], default: [] },
  },
  { _id: false },
);

// customerType (walking or listed)
const customerTypeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["walking", "listed"],
      required: true,
    },
    walking: { type: walkingCustomerSchema, default: null },
    listed: { type: listedCustomerSchema, default: null },
  },
  { _id: false },
);

/** -------------------------
 * Sales Schema
 * ------------------------*/

const salesSchema = new mongoose.Schema(
  {
    date: { type: Date, default: Date.now },
    deliveryDate: { type: Date },

    invoiceNumber: { type: String, trim: true, unique: true, index: true },

    customerType: { type: customerTypeSchema, required: true },

    searchItem: { type: [searchItemSchema], default: [] },

    salesMen: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },

    invoiceStatus: {
      type: String,
      enum: ["complete", "draft", "pending"],
      default: "draft",
    },

    remark: { type: String, trim: true },
    sendSms: { type: Boolean, default: false },

    total: { type: Number, default: 0, min: 0 },
    return: { type: Number, default: 0, min: 0 },

    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    vatPercent: { type: Number, default: 0, min: 0, max: 100 },

    deliveryCost: { type: Number, default: 0, min: 0 },
    labourCost: { type: Number, default: 0, min: 0 },

    lessTaka: { type: Number, default: 0, min: 0 },
    customerAdvancePaymentAdjust: { type: Number, default: 0, min: 0 },

    payable: { type: Number, default: 0, min: 0 },
    paid: { type: Number, default: 0, min: 0 },
    changes: { type: Number, default: 0, min: 0 },

    presentDue: { type: Number, default: 0, min: 0 },
    previousDue: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0 },

    paymentMethod: { type: paymentMethodSchema, default: {} },

    paymentStatus: {
      type: String,
      enum: ["paid", "partial", "due"],
    },

    salesType: {
      type: String,

      enum: ["wholesale", "retailsale"],
    },
  },
  { timestamps: true },
);

// Helpful indexes
salesSchema.index({ date: -1 });
salesSchema.index({ "customerType.listed.customerId": 1 });
salesSchema.index({ invoiceStatus: 1, paymentStatus: 1 });

salesSchema.pre("save", async function (next) {
  try {
    if (!this.isNew || this.invoiceNumber) return next();

    const prefix = process.env.INVOICE_PREFIX || "INV";

    let created = false;

    while (!created) {
      // last invoice খুঁজে বের করা
      const lastInvoice = await this.constructor
        .findOne({ invoiceNumber: { $regex: `^${prefix}-` } })
        .sort({ invoiceNumber: -1 })
        .select("invoiceNumber")
        .lean();

      let lastNumber = 0;

      if (lastInvoice?.invoiceNumber) {
        const numPart = lastInvoice.invoiceNumber.split("-")[1];
        lastNumber = Number(numPart) || 0;
      }

      const nextNumber = lastNumber + 1;

      // 6 digit serial
      const serial = String(nextNumber).padStart(6, "0");

      const newInvoice = `${prefix}-${serial}`;

      // duplicate check
      const exists = await this.constructor.exists({
        invoiceNumber: newInvoice,
      });

      if (!exists) {
        this.invoiceNumber = newInvoice;
        created = true;
      }
    }

    next();
  } catch (err) {
    next(err);
  }
});

const Sales = mongoose.models.Sales || mongoose.model("Sales", salesSchema);

module.exports = Sales;
