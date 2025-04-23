const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  validateProductInventory,
} = require("../validation/productInventory.validation");
const ProductInventory = require("../models/productInventory.model");

// @desc create a product
exports.createProductInventory = asynchandeler(async (req, res) => {
  // Validate the request body
  const validatedData = await validateProductInventory(req);
  // Create a new product inventory record
  const productInventory = new ProductInventory(validatedData);
  await productInventory.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    201,
    "Product inventory created successfully",
    productInventory
  );
});

//desc get all product inventory
exports.getAllProductInventory = asynchandeler(async (req, res) => {
  const productInventories = await ProductInventory.find().populate([
    "product",
    "variant",
    "discount",
  ]);
  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory fetched successfully",
    productInventories
  );
});

// @desc Get a single product inventory by product slug
exports.getProductInventoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Use aggregation pipeline to join and filter by product slug
  const productInventory = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products", // The name of the Product collection
        localField: "product", // The field in ProductInventory that references Product
        foreignField: "_id", // The field in Product that matches the reference
        as: "productResult", // The name of the joined field
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "variant",
        foreignField: "_id",
        as: "variantResult",
      },
    },
    {
      $lookup: {
        from: "discounts",
        localField: "discount",
        foreignField: "_id",
        as: "discountResult",
      },
    },
    {
      $unwind: "$discountResult",
    },

    {
      $unwind: "$variantResult",
    },
    {
      $unwind: "$productResult",
    },
    {
      $match: { "productResult.slug": "taufik-ali" },
    },
    {
      $project: {
        product: 1,
        "productResult.name": 1,
        "productResult.slug": 1,
        "productResult.image": 1,
        stock: 1,
        variant: "$variantResult",
        discount: "$discountResult",
        reverseStock: 1,
        instock: 1,
        warehouseLocation: 1,
        sellingPrice: 1,
        wholeSalePrice: 1,
        profitRate: 1,
        alertQuantity: 1,
        stockAlert: 1,
        isActive: 1,
        createdAt: 1,
        updatedAt: 1,
        profitPrice: {
          $add: ["$sellingPrice", 100],
        },
      },
    },
  ]);

  // Check if product inventory exists
  if (!productInventory || productInventory.length === 0) {
    throw new customError("Product inventory not found", 404);
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory fetched successfully",
    productInventory // Return the first (and only) result
  );
});
