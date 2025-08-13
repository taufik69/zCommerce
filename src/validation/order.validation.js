const Joi = require("joi");
const { customError } = require("../lib/CustomError");

const orderSchema = Joi.object({
  user: Joi.string().optional().allow(null),
  guestId: Joi.string().optional().allow(null),

  items: Joi.array().items(Joi.string().required()).required().messages({
    "array.base": "Items must be an array",
    "array.min": "At least one item is required",
    "any.required": "Items are required",
  }),

  shippingInfo: Joi.object({
    fullName: Joi.string().trim().required().messages({
      "any.required": "Full name is required",
      "string.empty": "Full name cannot be empty",
    }),
    phone: Joi.string().trim().messages({
      "any.required": "Phone number is required",
      "string.empty": "Phone number cannot be empty",
    }),
    address: Joi.string().trim().required().messages({
      "any.required": "Address is required",
      "string.empty": "Address cannot be empty",
    }),
    city: Joi.string().optional().allow(""),
    postalCode: Joi.string().optional().allow(""),
    country: Joi.string().default("Bangladesh"),
    deliveryZone: Joi.string()
      .valid("inside_dhaka", "outside_dhaka", "sub_area")
      .required()
      .messages({
        "any.only":
          "Delivery zone must be one of: inside_dhaka, outside_dhaka, sub_area",
        "any.required": "Delivery zone is required",
      }),
  }).required(),

  deliveryCharge: Joi.string().required().messages({
    "any.required": "Delivery charge is required",
    "number.base": "Delivery charge must be a number",
  }),

  coupon: Joi.string().optional().allow(null),
  discountAmount: Joi.number().min(0).default(0),

  subtotal: Joi.number().required().messages({
    "any.required": "Subtotal is required",
    "number.base": "Subtotal must be a number",
  }),

  totalAmount: Joi.number().required().messages({
    "any.required": "Total amount is required",
    "number.base": "Total amount must be a number",
  }),

  paymentMethod: Joi.string().valid("cod", "sslcommerz").required().messages({
    "any.only": "Payment method must be 'cod' or 'sslcommerz'",
    "any.required": "Payment method is required",
  }),

  paymentStatus: Joi.string()
    .valid("pending", "paid", "failed")
    .default("pending"),

  orderStatus: Joi.string()
    .valid("pending", "processing", "shipped", "delivered", "cancelled")
    .default("pending"),

  invoiceId: Joi.string().optional().allow(null),
}).options({ abortEarly: false, allowUnknown: true }); // all validation errors at once

const validateOrder = async (req) => {
  try {
    const value = await orderSchema.validateAsync(req.body);
    return value;
  } catch (error) {
    console.log(
      "Order Validation error: " +
        error.details.map((err) => err.message).join(", ")
    );
    throw new customError(
      "Order Validation Error: " +
        error.details.map((err) => err.message).join(", "),
      400
    );
  }
};

module.exports = validateOrder;
