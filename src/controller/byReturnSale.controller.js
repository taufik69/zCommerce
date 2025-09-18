// controllers/byReturnController.js
const ByReturn = require("../models/byReturnSale.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

// ✅ Validation function
const validateByReturn = (req) => {
  const { product, variant, productBarCode, supplierName, quantity } = req.body;

  if (!supplierName) throw new customError("Supplier name is required", 400);
  if (!quantity || quantity <= 0)
    throw new customError("Quantity must be greater than 0", 400);

  return req.body;
};

// @desc create a new byReturn
exports.createByReturn = asynchandeler(async (req, res) => {
  const data = validateByReturn(req);

  const byReturn = await ByReturn.create({
    product: data.product || null,
    variant: data.variant || null,
    productBarCode: data.productBarCode,
    supplierName: data.supplierName,
    quantity: data.quantity,
    date: data.date,
    remarks: data.remarks,
  });

  // ✅ push this byReturn id into product.salesReturn
  if (data.product) {
    const product = await Product.findById(data.product);
    if (!product) {
      throw new customError("Product not found", 404);
    }
    product.byReturn.push(byReturn._id);
    await product.save();
  }

  // ✅ push this byReturn id into variant.salesReturn
  if (data.variant) {
    const variant = await Variant.findById(data.variant);
    if (!variant) {
      throw new customError("Variant not found", 404);
    }
    variant.byReturn.push(byReturn._id);
    await variant.save();
  }

  apiResponse.sendSuccess(res, 201, "ByReturn created successfully", byReturn);
});

// @desc get all byReturns
exports.getAllByReturns = asynchandeler(async (req, res) => {
  const byReturns = await ByReturn.find().populate("product variant").sort({
    createdAt: -1,
  });
  apiResponse.sendSuccess(res, 200, "ByReturns found", byReturns);
});

//@desc get single byReturn using slug
exports.getSingleByReturn = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    throw new customError("ID is required", 400);
  }
  const byReturn = await ByReturn.findOne({ slug })
    .populate("product")
    .populate("variant");
  if (!byReturn) {
    throw new customError("ByReturn not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "ByReturn fetched successfully", byReturn);
});

// @desc update a byReturn by slug
// @desc update a byReturn (using slug instead of id)
exports.updateByReturn = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Validate input
  const data = validateByReturn(req);

  // ✅ Find existing byReturn by slug
  const byReturn = await ByReturn.findOne({ slug });
  if (!byReturn) {
    throw new customError("ByReturn not found", 404);
  }

  // ✅ If product changed, update relation
  if (
    data.product &&
    data.product.toString() !== byReturn.product?.toString()
  ) {
    if (byReturn.product) {
      const oldProduct = await Product.findById(byReturn.product);
      if (oldProduct) {
        oldProduct.byReturn.pull(byReturn._id);
        await oldProduct.save();
      }
    }

    const newProduct = await Product.findById(data.product);
    if (!newProduct) throw new customError("New Product not found", 404);

    newProduct.byReturn.push(byReturn._id);
    await newProduct.save();

    byReturn.product = data.product;
  }

  // ✅ If variant changed, update relation
  if (
    data.variant &&
    data.variant.toString() !== byReturn.variant?.toString()
  ) {
    if (byReturn.variant) {
      const oldVariant = await Variant.findById(byReturn.variant);
      if (oldVariant) {
        oldVariant.byReturn.pull(byReturn._id);
        await oldVariant.save();
      }
    }

    const newVariant = await Variant.findById(data.variant);
    if (!newVariant) throw new customError("New Variant not found", 404);

    newVariant.byReturn.push(byReturn._id);
    await newVariant.save();

    byReturn.variant = data.variant;
  }

  // ✅ Update other fields
  byReturn.productBarCode = data.productBarCode || byReturn.productBarCode;
  byReturn.supplierName = data.supplierName || byReturn.supplierName;
  byReturn.quantity = data.quantity || byReturn.quantity;
  byReturn.date = data.date || byReturn.date;
  byReturn.remarks = data.remarks || byReturn.remarks;

  await byReturn.save();

  apiResponse.sendSuccess(res, 200, "ByReturn updated successfully", byReturn);
});

// delete byReturn
// @desc delete a byReturn (using slug)
exports.deleteByReturn = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // ✅ Find byReturn by slug
  const byReturn = await ByReturn.findOne({ slug });
  if (!byReturn) {
    throw new customError("ByReturn not found", 404);
  }

  // ✅ Remove from product.byReturn array
  if (byReturn.product) {
    const product = await Product.findById(byReturn.product);
    if (product) {
      product.byReturn.pull(byReturn._id);
      await product.save();
    }
  }

  // ✅ Remove from variant.byReturn array
  if (byReturn.variant) {
    const variant = await Variant.findById(byReturn.variant);
    if (variant) {
      variant.byReturn.pull(byReturn._id);
      await variant.save();
    }
  }

  // ✅ Delete byReturn document
  await ByReturn.deleteOne({ _id: byReturn._id });

  apiResponse.sendSuccess(res, 200, "ByReturn deleted successfully", null);
});
