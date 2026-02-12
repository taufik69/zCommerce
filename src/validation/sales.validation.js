// validations/sales.validation.js
const Joi = require("joi");
const { apiResponse } = require("../utils/apiResponse");
const { jabcode } = require("bwip-js/node");

// helpers
const objectId = Joi.string().trim().length(24).hex().messages({
  "string.length": "Invalid ObjectId",
  "string.hex": "Invalid ObjectId",
});

const walkingCustomerSchema = Joi.object({
  customerName: Joi.string().trim().allow("").optional(),
  mobileNumber: Joi.string().trim().allow("").optional(),
  email: Joi.string().trim().lowercase().email().allow("").optional(),
  address: Joi.string().trim().allow("").optional(),
}).options({ allowUnknown: true });

const customerTypeSchema = Joi.object({
  type: Joi.string().valid("walking", "listed").required(),
  walking: walkingCustomerSchema.optional().allow(null),
  customerId: objectId.optional().allow(null),
})
  .custom((value, helpers) => {
    // type অনুযায়ী required nested enforce
    if (value.type === "walking" && !value.walking) {
      return helpers.error("any.custom", {
        message: "walking customer info is required",
      });
    }
    if (value.type === "customerId" && !value.listed) {
      return helpers.error("any.custom", {
        message: "customerId   is required",
      });
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  })
  .options({ allowUnknown: true });

const searchItemSchema = Joi.object({
  productId: objectId.optional().allow(null),
  variantId: objectId.optional().allow(null),
  salesStatus: Joi.string().valid("sale", "return").required(),
  barcode: Joi.string().trim().allow("").optional(),
  productDescription: Joi.string().trim().allow("").optional(),

  color: Joi.string().trim().allow("").optional(),
  size: Joi.string().trim().allow("").optional(),

  quantity: Joi.number().min(0).default(1),
  groupQuantity: Joi.number().min(0).default(0),
  unit: Joi.string().trim().allow("").optional(),
  salesRate: Joi.number().min(0).default(0),
  discount: Joi.number().min(0).default(0),

  subtotal: Joi.number().min(0).default(0),
})
  .custom((value, helpers) => {
    // productId বা variantId
    if (!value.productId && !value.variantId) {
      return helpers.error("any.custom", {
        message: "searchItem requires productId or variantId",
      });
    }
    return value;
  })
  .messages({
    "any.custom": "{{#message}}",
  })
  .options({ allowUnknown: true });

const singlePaymentSchema = Joi.object({
  amount: Joi.number().min(0).default(0),
  paymentTo: Joi.string().trim().allow("").optional(),
  remark: Joi.string().trim().allow("").optional(),
}).options({ allowUnknown: true });

const multiplePaymentSchema = Joi.object({
  amount: Joi.number().min(0).default(0),
  paymentTo: Joi.string().trim().allow("").optional(),
  remark: Joi.string().trim().allow("").optional(),
}).options({ allowUnknown: true });

const paymentMethodSchema = Joi.object({
  singlePayment: singlePaymentSchema.allow(null).optional(),
  multiplePayment: Joi.array().items(multiplePaymentSchema).default([]),
}).options({ allowUnknown: true });

/** =========================
 * CREATE SALES
 * ========================= */
const createSalesSchema = Joi.object({
  date: Joi.date().optional(),
  deliveryDate: Joi.date().optional(),

  invoiceNumber: Joi.string().trim().optional(),

  customerType: customerTypeSchema.required(),

  searchItem: Joi.array().items(searchItemSchema).min(1).required().messages({
    "array.min": "At least 1 item is required",
  }),

  salesMen: objectId.optional(),

  invoiceStatus: Joi.string()
    .valid("complete", "draft", "pending")
    .default("draft"),

  remark: Joi.string().trim().allow("").optional(),
  sendSms: Joi.boolean().default(false),

  total: Joi.number().min(0).default(0),
  return: Joi.number().min(0).default(0),

  discountPercent: Joi.number().min(0).max(100).default(0),
  vatPercent: Joi.number().min(0).max(100).default(0),

  deliveryCost: Joi.number().min(0).default(0),
  labourCost: Joi.number().min(0).default(0),

  lessTaka: Joi.number().min(0).default(0),
  customerAdvancePaymentAdjust: Joi.number().min(0).default(0),

  payable: Joi.number().min(0).default(0),
  paid: Joi.number().min(0).default(0),
  changes: Joi.number().min(0).default(0),

  presentDue: Joi.number().min(0).default(0),
  previousDue: Joi.number().min(0).default(0),
  balance: Joi.number().default(0),

  paymentMethod: paymentMethodSchema.default({}),

  paymentStatus: Joi.string().valid("paid", "partial", "due").optional(),
}).options({ abortEarly: false, allowUnknown: true });

/** =========================
 * UPDATE SALES
 * ========================= */
const updateSalesSchema = Joi.object({
  date: Joi.date().optional(),
  deliveryDate: Joi.date().optional(),

  invoiceNumber: Joi.string().trim().optional(),

  customerType: customerTypeSchema.optional(),

  searchItem: Joi.array().items(searchItemSchema).optional(),

  salesMen: objectId.optional(),

  invoiceStatus: Joi.string().valid("complete", "draft", "pending").optional(),

  remark: Joi.string().trim().allow("").optional(),
  sendSms: Joi.boolean().optional(),

  total: Joi.number().min(0).optional(),
  return: Joi.number().min(0).optional(),

  discountPercent: Joi.number().min(0).max(100).optional(),
  vatPercent: Joi.number().min(0).max(100).optional(),

  deliveryCost: Joi.number().min(0).optional(),
  labourCost: Joi.number().min(0).optional(),

  lessTaka: Joi.number().min(0).optional(),
  customerAdvancePaymentAdjust: Joi.number().min(0).optional(),

  payable: Joi.number().min(0).optional(),
  paid: Joi.number().min(0).optional(),
  changes: Joi.number().min(0).optional(),

  presentDue: Joi.number().min(0).optional(),
  previousDue: Joi.number().min(0).optional(),
  balance: Joi.number().optional(),

  paymentMethod: paymentMethodSchema.optional(),

  paymentStatus: Joi.string().valid("paid", "partial", "due").optional(),

  salesType: Joi.string().valid("wholesale", "retailsale").optional(),
})
  .min(1)
  .options({ abortEarly: false, allowUnknown: true });

module.exports = {
  createSalesSchema,
  updateSalesSchema,
};
