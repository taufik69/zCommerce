const { customError } = require("../lib/CustomError");
const productModel = require("../models/product.model");
const variantModel = require("../models/variant.model");
const orderModel = require("../models/order.model");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const { statusCodes } = require("../constant/constant");

//  Create Courier Return (Promise.all optimized)
exports.createCourierReturn = asynchandeler(async (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    throw new customError("Order ID is required", statusCodes.BAD_REQUEST);
  }

  //  Find order with items & courier info
  const order = await orderModel.findById(orderId).select("items courier");

  if (!order) {
    throw new customError("Order not found", statusCodes.NOT_FOUND);
  }

  const { items, courier, _id } = order;

  // Map each item to a Promise (parallel updates)
  const updatePromises = items.map((item) => {
    const { product, variant, quantity, orderType } = item;

    //  If single variant product
    if (orderType === "singlevariant" && product) {
      return productModel.findByIdAndUpdate(
        product,
        {
          $inc: { stock: quantity },
          $set: {
            courierReturn: {
              orderId: _id,
              product: product,
              variant: null,
              recivedQuantity: quantity,
              courierName: courier?.name || "Unknown",
            },
          },
        },
        { new: true },
      );
    }

    // 🟦 If multi variant product
    if (orderType === "multivariant" && variant) {
      return variantModel.findByIdAndUpdate(
        variant,
        {
          $inc: { stockVariant: quantity },
          $set: {
            courierReturn: {
              orderId: _id,
              variant: variant,
              product: null,
              recivedQuantity: quantity,
              courierName: courier?.name || "Unknown",
            },
          },
        },
        { new: true },
      );
    }

    // 🚫 Invalid item fallback
    return Promise.resolve(null);
  });

  // ✅ Run all DB operations in parallel
  const results = await Promise.all(updatePromises);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Courier return processed successfully — stock updated.",
    results.filter(Boolean),
  );
});

// get all courier returns
exports.getAllCourierReturns = asynchandeler(async (req, res) => {
  //  Find products with courierReturn field present
  const courierReturns = await productModel
    .find({
      courierReturn: { $exists: true, $ne: null },
    })
    .populate("courierReturn.product");

  //  Find variants with courierReturn field present
  const variantReturns = await variantModel
    .find({
      courierReturn: { $exists: true, $ne: null },
    })
    .populate("courierReturn.variant");

  //  If no returns found
  if (!courierReturns.length && !variantReturns.length) {
    throw new customError("No courier returns found", statusCodes.NOT_FOUND);
  }

  //  Merge both arrays
  const allReturns = [...courierReturns, ...variantReturns];

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Fetched all courier returns successfully.",
    allReturns,
  );
});
