const Joi = require("joi");

const columnSchema = Joi.object({
  key: Joi.string()
    .trim()
    .lowercase()
    .pattern(/^[a-z0-9_]+$/)
    .required()
    .messages({ "string.pattern.base": "Column key must be lowercase alphanumeric with underscores only" }),
  label: Joi.string().trim().required(),
  unit: Joi.string()
    .valid("inch", "cm", "mm", "kg", "lbs", "ml", "l", "unitless")
    .default("unitless"),
  order: Joi.number().integer().min(0).default(0),
  description: Joi.string().trim().max(500).optional().allow(""),
});

const rowSchema = Joi.object({
  label: Joi.string().trim().required(),
  values: Joi.array().items(Joi.string().allow("")).min(1).required(),
  order: Joi.number().integer().min(0).default(0),
  sku: Joi.string().trim().optional().allow(""),
});

const createSizeChartSchema = Joi.object({
  name: Joi.string().trim().max(100).required(),
  description: Joi.string().trim().max(1000).optional().allow(""),
  applicableLevel: Joi.string()
    .valid("category", "subCategory", "product", "variant", "brand")
    .required(),
  applicableCategories: Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableSubCategories: Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableProducts: Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableVariants: Joi.array().items(Joi.string().hex().length(24)).default([]),
  applicableBrands: Joi.array().items(Joi.string().hex().length(24)).default([]),
  columns: Joi.array().items(columnSchema).min(1).max(10).required(),
  rows: Joi.array().items(rowSchema).min(1).required(),
  videoUrl: Joi.string().uri({ scheme: ["http", "https"] }).optional().allow(""),
}).options({ abortEarly: false });

const updateSizeChartSchema = createSizeChartSchema.fork(
  ["name", "applicableLevel", "columns", "rows"],
  (field) => field.optional(),
);

module.exports = { createSizeChartSchema, updateSizeChartSchema };
