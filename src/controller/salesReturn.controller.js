const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const SalesReturn = require("../models/salesReturn.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { validateByReturn } = require("../validation/salesReturn.validation");

// @desc create a new sales return
exports.createSalesReturn = asynchandeler(async (req, res) => {
  const data = await validateByReturn(req);
  const salesReturn = await SalesReturn.create({
    product: data.product || null,
    variant: data.variant || null,
    productBarCode: data.productBarCode,
    quantity: data.quantity,
    date: data.date,
    remarks: data.remarks,
  });
  //   find the  productid and push this sales return id
  if (data.product) {
    const product = await Product.findOne({ _id: data.product });
    if (!product) {
      throw new customError("Product not found", 404);
    }
    product.salesReturn.push(salesReturn._id);
    await product.save();
  }
  if (data.variant) {
    //   find the  variantid and push this sales return id
    const variant = await Variant.findOne({ _id: data.variant });
    if (!variant) {
      throw new customError("Variant not found", 404);
    }
    variant.salesReturn.push(salesReturn._id);
    await variant.save();
  }

  apiResponse.sendSuccess(res, 200, "Sales Return created", salesReturn);
});

//@desc get all sales return
exports.getAllSalesReturn = asynchandeler(async (req, res) => {
  const salesReturn = await SalesReturn.find()
    .populate("product")
    .populate("variant")
    .sort({ createdAt: -1 });
  if (!salesReturn || salesReturn.length === 0) {
    throw new customError("No sales return found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Sales Return fetched successfully",
    salesReturn
  );
});

//@desc get single sales return using slug
exports.getSingleSalesReturn = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  if (!slug) {
    throw new customError("ID is required", 400);
  }
  const salesReturn = await SalesReturn.findOne({ slug })
    .populate("product")
    .populate("variant");
  if (!salesReturn) {
    throw new customError("Sales Return not found", 404);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "Sales Return fetched successfully",
    salesReturn
  );
});

// @desc delete sales return by slug and when delete slales return then delete sales return id from p roducxt and variant model
exports.deleteSalesReturnBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const salesReturn = await SalesReturn.findOne({ slug });
  if (!salesReturn) {
    return apiResponse.sendError(res, 404, "Sales Return not found");
  }
  // delete sales return id from product model
  if (salesReturn.product) {
    const product = await Product.findOne({ _id: salesReturn.product });
    if (!product) {
      throw new customError("Product not found", 404);
    }
    product.salesReturn = product.salesReturn.pull(salesReturn._id);
    await product.save();
  }
  // delete sales return id from variant model
  if (salesReturn.variant) {
    const variant = await Variant.findOne({ _id: salesReturn.variant });
    if (!variant) {
      throw new customError("Variant not found", 404);
    }
    variant.salesReturn = variant.salesReturn.pull(salesReturn._id);
    await variant.save();
  }
  await SalesReturn.findByIdAndDelete(salesReturn._id);
  apiResponse.sendSuccess(res, 200, "Sales Return deleted successfully");
});

//update salesReturn
exports.updateSalesReturn = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const data = await validateByReturn(req);

  // Find existing sales return
  const salesReturn = await SalesReturn.findOne({ slug });
  if (!salesReturn) {
    throw new customError("Sales Return not found", 404);
  }

  /** -----------------------------------
   * 🔹 Handle Product Change
   * ----------------------------------- */
  if (
    data.product &&
    data.product.toString() !== (salesReturn.product?.toString() || "")
  ) {
    // Remove from old product
    if (salesReturn.product) {
      await Product.findByIdAndUpdate(salesReturn.product, {
        $pull: { salesReturn: salesReturn._id },
      });
    }
    // Add to new product
    await Product.findByIdAndUpdate(data.product, {
      $addToSet: { salesReturn: salesReturn._id },
    });
    salesReturn.product = data.product;
  }

  /** -----------------------------------
   * 🔹 Handle Variant Change
   * ----------------------------------- */
  if (
    data.variant &&
    data.variant.toString() !== (salesReturn.variant?.toString() || "")
  ) {
    // Remove from old variant
    if (salesReturn.variant) {
      await Variant.findByIdAndUpdate(salesReturn.variant, {
        $pull: { salesReturn: salesReturn._id },
      });
    }
    // Add to new variant
    await Variant.findByIdAndUpdate(data.variant, {
      $addToSet: { salesReturn: salesReturn._id },
    });
    salesReturn.variant = data.variant;
  }

  /** -----------------------------------
   * 🔹 Update Other Fields
   * ----------------------------------- */
  salesReturn.productBarCode =
    data.productBarCode || salesReturn.productBarCode;
  salesReturn.quantity = data.quantity || salesReturn.quantity;
  salesReturn.date = data.date || salesReturn.date;
  salesReturn.remarks = data.remarks || salesReturn.remarks;

  await salesReturn.save();

  apiResponse.sendSuccess(
    res,
    200,
    "Sales Return updated successfully",
    salesReturn
  );
});

//delete salesReturn
exports.deleteSalesReturn = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the sales return
  const salesReturn = await SalesReturn.findOne({ slug });
  if (!salesReturn) {
    throw new customError("Sales Return not found", 404);
  }

  /** ------------------------------
   * 🔹 Remove reference from Product
   * ------------------------------ */
  if (salesReturn.product) {
    await Product.findByIdAndUpdate(
      salesReturn.product,
      { $pull: { salesReturn: salesReturn._id } },
      { new: true }
    );
  }

  /** ------------------------------
   * 🔹 Remove reference from Variant
   * ------------------------------ */
  if (salesReturn.variant) {
    await Variant.findByIdAndUpdate(
      salesReturn.variant,
      { $pull: { salesReturn: salesReturn._id } },
      { new: true }
    );
  }

  // Delete sales return
  await SalesReturn.findOneAndDelete({ slug });

  apiResponse.sendSuccess(res, 200, "Sales Return deleted successfully");
});
