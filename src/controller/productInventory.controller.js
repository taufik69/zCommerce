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

//@desc get all product inventory
exports.getAllProductInventory = asynchandeler(async (req, res) => {
  const productInventories = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productResult",
      },
    },
    {
      $unwind: {
        path: "$productResult",
        preserveNullAndEmptyArrays: true,
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
      $unwind: {
        path: "$variantResult",
        preserveNullAndEmptyArrays: true,
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
      $unwind: {
        path: "$discountResult",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "categories",
        localField: "productResult.category",
        foreignField: "_id",
        as: "categoryResult",
      },
    },
    {
      $unwind: {
        path: "$categoryResult",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "productResult.subcategory",
        foreignField: "_id",
        as: "subcategoryResult",
      },
    },
    {
      $unwind: {
        path: "$subcategoryResult",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        stock: 1,
        reverseStock: 1,
        instock: 1,
        warehouseLocation: 1,
        sellingPrice: 1,
        wholeSalePrice: 1,
        profitRate: 1,
        alertQuantity: 1,
        stockAlert: 1,
        // Flatten product fields
        productId: "$productResult._id",
        name: "$productResult.name",
        description: "$productResult.description",
        category: "$categoryResult",
        subcategory: "$subcategoryResult",
        brand: "$productResult.brand",
        discountId: "$productResult.discountId",
        thumbnail: "$productResult.thumbnail",
        image: "$productResult.image",
        tag: "$productResult.tag",
        isActive: "$productResult.isActive",
        createdAt: "$productResult.createdAt",
        updatedAt: "$productResult.updatedAt",
        slug: "$productResult.slug",

        // Keep variant and discount as objects
        variant: "$variantResult",
        discount: "$discountResult",
      },
    },
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
      $unwind: {
        path: "$productResult",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $match: {
        "productResult.slug": slug,
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
      $unwind: {
        path: "$variantResult",
        preserveNullAndEmptyArrays: true,
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
      $unwind: {
        path: "$discountResult",
        preserveNullAndEmptyArrays: true,
      },
    },

    {
      $lookup: {
        from: "categories",
        localField: "productResult.category",
        foreignField: "_id",
        as: "categoryResult",
      },
    },
    {
      $unwind: {
        path: "$categoryResult",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "productResult.subcategory",
        foreignField: "_id",
        as: "subcategoryResult",
      },
    },
    {
      $unwind: {
        path: "$subcategoryResult",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $project: {
        _id: 1,
        stock: 1,
        reverseStock: 1,
        instock: 1,
        warehouseLocation: 1,
        sellingPrice: 1,
        wholeSalePrice: 1,
        profitRate: 1,
        alertQuantity: 1,
        stockAlert: 1,
        // Flatten product fields
        productId: "$productResult._id",
        name: "$productResult.name",
        description: "$productResult.description",
        category: "$categoryResult",
        subcategory: "$subcategoryResult",
        brand: "$productResult.brand",
        discountId: "$productResult.discountId",
        thumbnail: "$productResult.thumbnail",
        image: "$productResult.image",
        tag: "$productResult.tag",
        isActive: "$productResult.isActive",
        createdAt: "$productResult.createdAt",
        updatedAt: "$productResult.updatedAt",
        slug: "$productResult.slug",

        // Keep variant and discount as objects
        variant: "$variantResult",
        discount: "$discountResult",
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

// @desc update product inventory
exports.updateProductInventory = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;

  // Step 1: Find the inventory by matching product slug
  const inventoryResult = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productResult",
      },
    },
    {
      $unwind: "$productResult",
    },
    {
      $match: { "productResult.slug": slug },
    },
    {
      $project: { _id: 1 }, // We just need the inventory _id to update
    },
  ]);

  if (!inventoryResult?.length) {
    throw new customError("Product inventory not found", 404);
  }

  const inventoryId = inventoryResult[0]._id;

  // Step 2: Update the inventory by _id
  const updatedInventory = await ProductInventory.findByIdAndUpdate(
    inventoryId,
    { $set: req.body },
    { new: true }
  );

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory updated successfully",
    updatedInventory
  );
});

//@desc search the productinventory using product slug
exports.searchProductInventoryBySlug = asynchandeler(async (req, res) => {
  const { name } = req.query;

  const productInventory = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productResult",
      },
    },
    {
      $unwind: "$productResult",
    },
    {
      $match: {
        "productResult.name": {
          $regex: name?.trim(),
          $options: "i",
        },
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
      $unwind: "$variantResult",
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
      $lookup: {
        from: "categories",
        localField: "productResult.category",
        foreignField: "_id",
        as: "categoryResult",
      },
    },
    {
      $unwind: "$categoryResult",
    },
    {
      $project: {
        product: "$productResult",
        stock: 1,
        variant: "$variantResult",
        discount: "$discountResult",
        category: "$categoryResult",
        reverseStock: 1,
        instock: 1,
        warehouseLocation: 1,
        sellingPrice: 1,
        wholeSalePrice: 1,
        profitRate: 1,
        alertQuantity: 1,
        stockAlert: 1,
        isActive: 1,
      },
    },
  ]);

  if (!productInventory || productInventory.length === 0) {
    throw new customError("Product inventory not found", 404);
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory fetched successfully",
    productInventory
  );
});

//@desc show productinventory in accending order
exports.getProductInventoryInOrder = asynchandeler(async (req, res) => {
  const { order } = req.query;
  const productInventory = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productResult",
      },
    },
    {
      $unwind: "$productResult",
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
      $unwind: "$variantResult",
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
      $lookup: {
        from: "categories",
        localField: "productResult.category",
        foreignField: "_id",
        as: "categoryResult",
      },
    },
    {
      $unwind: "$categoryResult",
    },
    {
      $project: {
        product: "$productResult",
        stock: 1,
        variant: "$variantResult",
        discount: "$discountResult",
        category: "$categoryResult",
        reverseStock: 1,
        instock: 1,
        warehouseLocation: 1,
        sellingPrice: 1,
        wholeSalePrice: 1,
        profitRate: 1,
        alertQuantity: 1,
        stockAlert: 1,
        isActive: 1,
      },
    },
    {
      $sort: { createdAt: order == 1 ? 1 : -1 },
    },
  ]);

  if (!productInventory || productInventory.length === 0) {
    throw new customError("Product inventory not found", 404);
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory fetched successfully",
    productInventory
  );
});

//@desc make pagination form productinventory
exports.getProductInventoryPagination = asynchandeler(async (req, res) => {
  const { limit, page } = req.query;
  const skip = (page - 1) * limit;
  const productInventory = await ProductInventory.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: 1 })
    .populate(["product", "variant", "discount"]);
  const total = await ProductInventory.countDocuments();
  const totalPages = Math.ceil(total / limit);

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory fetched successfully",
    {
      productInventory,
      page,
      limit,
      total,
      totalPages,
    }
  );
});

//@desc deactive productInventory searching by product slug using aggregation
exports.deactivateProductInventoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  const productInventory = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productResult",
      },
    },
    {
      $unwind: "$productResult",
    },
    {
      $match: { "productResult.slug": slug },
    },
    {
      $project: {
        _id: 1,
        isActive: 0,
      },
    },
  ]);

  if (!productInventory || productInventory.length === 0) {
    throw new customError("Product inventory not found", 404);
  }

  const updateProduct = await ProductInventory.findByIdAndUpdate(
    productInventory[0]._id,
    {
      isActive: false,
    },
    {
      new: true,
    }
  );

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory deactivated successfully",
    updateProduct
  );
});

//@desc active productInventory seraching by product slug using aggregation

exports.activateProductInventoryBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  const productInventory = await ProductInventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productResult",
      },
    },
    {
      $unwind: "$productResult",
    },
    {
      $match: { "productResult.slug": slug },
    },
    {
      $project: {
        _id: 1,
        isActive: 0,
      },
    },
  ]);

  if (!productInventory || productInventory.length === 0) {
    throw new customError("Product inventory not found", 404);
  }

  const updateProduct = await ProductInventory.findByIdAndUpdate(
    productInventory[0]._id,
    {
      isActive: true,
    },
    {
      new: true,
    }
  );

  return apiResponse.sendSuccess(
    res,
    200,
    "Product inventory activated successfully",
    updateProduct
  );
});
