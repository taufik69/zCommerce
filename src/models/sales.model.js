require("dotenv").config();
const mongoose = require("mongoose");
const Counter = require("./counter.model");

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

// searchItem (embedded array)
const searchItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },

    salesStatus: {
      type: String,
      enum: ["sale", "return", "exchange"],
      default: "sale",
    },

    barcode: { type: String, trim: true },
    productDescription: { type: String, trim: true },

    color: { type: String, trim: true },
    size: { type: String, trim: true },

    quantity: { type: Number, default: 1, min: 0 },
    groupQuantity: { type: Number, default: 0, min: 0 },
    unit: { type: String, trim: true },

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
    paymentTo: { type: mongoose.Types.ObjectId, ref: "Account", trim: true },
    remark: { type: String, trim: true },
  },
  { _id: false },
);

const multiplePaymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, default: 0, min: 0 },
    paymentTo: { type: mongoose.Types.ObjectId, ref: "Account", trim: true },
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
      default: "walking",
      required: true,
    },
    walking: { type: walkingCustomerSchema, default: null },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
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

    salesMen: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: [true, "Salesman is required"],
    },

    // The logged-in user (seller/admin) who created this sale and is
    // accountable for any discount applied. Set server-side from req.user,
    // never trusted from the request body. Populated in reports.
    discountGivenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

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
      default: "due",
    },

    salesType: {
      type: String,
      enum: ["wholesale", "retailsale", "retailsaleorder", "wholesaleorder"],
      default: "retailsale",
    },
  },
  { timestamps: true },
);

// Auto-generate a sequential, never-reused invoiceNumber after first save —
// e.g. INV-SI-01. The counter is atomic, so concurrent sales can't collide the
// way a find-the-last-invoice-and-increment scan can.
salesSchema.post("save", async function (doc, next) {
  try {
    if (doc.invoiceNumber) return next();

    const session = doc.$session();

    const counter = await Counter.findOneAndUpdate(
      { key: "SALES_INVOICE" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session },
    );

    const padded = String(counter.seq).padStart(2, "0");
    doc.invoiceNumber = `INV-SI-${padded}`;
    await doc.constructor.updateOne(
      { _id: doc._id },
      { $set: { invoiceNumber: doc.invoiceNumber } },
      { session },
    );
    next();
  } catch (error) {
    next(error);
  }
});

const Sales = mongoose.models.Sales || mongoose.model("Sales", salesSchema);

module.exports = Sales;
