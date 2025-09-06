const Purchase = require("../models/purchase.model");
const Product = require("../models/product.model");
const Variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");

exports.createPurchase = asynchandeler(async (req, res) => {
  const {
    invoiceNumber,
    supplierName,
    cashType,
    allproduct, // [{ product, variant, price, wholesalePrice, retailPrice, quantity, size, color }]
    commission = 0,
    shipping = 0,
    paid = 0,
  } = req.body;

  // Validate request
  if (!allproduct || !Array.isArray(allproduct) || allproduct.length === 0) {
    throw new customError("At least one product or variant is required", 400);
  }

  // Calculate totals
  let subTotal = 0;
  const purchaseProducts = [];

  for (const item of allproduct) {
    const {
      product,
      variant,
      purchasePrice,
      retailPrice,
      wholesalePrice,
      quantity,
      size,
      color,
    } = item;

    if (!purchasePrice || !retailPrice || !quantity) continue; // skip invalid entries

    const subTotalItem = purchasePrice * quantity;
    subTotal += subTotalItem;

    // Prepare purchase product entry
    purchaseProducts.push({
      product: product || null,
      variant: variant || null,
      purchasePrice,
      retailPrice,
      wholesalePrice,
      subTotal: subTotalItem,
      quantity,
      size: size || null,
      color: color || null,
    });

    /** ------------------------------
     * 🔹 Update Product or Variant Stock & Info
     * ------------------------------ */
    if (product) {
      const productInfo = await Product.findById(product);
      if (productInfo) {
        productInfo.stock = (productInfo.stock || 0) + quantity;
        productInfo.wholesalePrice = wholesalePrice;
        productInfo.purchasePrice = purchasePrice;
        productInfo.retailPrice = retailPrice;
        if (size)
          productInfo.size = Array.from(
            new Set([...(productInfo.size || []), size])
          );
        if (color)
          productInfo.color = Array.from(
            new Set([...(productInfo.color || []), color])
          );
        await productInfo.save();
      }
    }

    if (variant) {
      const variantInfo = await Variant.findById(variant);
      if (variantInfo) {
        variantInfo.stockVariant = (variantInfo.stockVariant || 0) + quantity;
        variantInfo.wholesalePrice = wholesalePrice;
        variantInfo.purchasePrice = purchasePrice;
        variantInfo.retailPrice = retailPrice;
        if (size)
          variantInfo.size = Array.from(
            new Set([...(variantInfo.size || []), size])
          );
        if (color)
          variantInfo.color = Array.from(
            new Set([...(variantInfo.color || []), color])
          );
        await variantInfo.save();
      }
    }
  }

  const payable = subTotal + shipping + commission;
  const dueamount = payable - paid;

  // Create Purchase document
  const purchase = await Purchase.create({
    invoiceNumber,
    supplierName,
    cashType,
    allproduct: purchaseProducts,
    subTotal,
    commission,
    shipping,
    payable,
    paid,
    dueamount,
    ...req.body,
  });

  if (!purchase) throw new customError("Failed to create purchase", 500);

  apiResponse.sendSuccess(res, 201, "Purchase created successfully", purchase);
});

// get all purchases
exports.getAllPurchases = asynchandeler(async (req, res) => {
  const purchases = await Purchase.find()
    .populate({
      path: "allproduct.product",
    })
    .populate({
      path: "allproduct.variant",
    })
    .sort({ createdAt: -1 });
  apiResponse.sendSuccess(
    res,
    200,
    "Purchases fetched successfully",
    purchases
  );
});
// get single product using slug
exports.getSinglePurchase = asynchandeler(async (req, res) => {
  const { id } = req.params;
  if (!id) {
    throw new customError("ID is required", 400);
  }
  const purchase = await Purchase.findById(id)
    .populate({
      path: "allproduct.product",
    })
    .populate({
      path: "allproduct.variant",
    });
  if (!purchase) {
    throw new customError("Purchase not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Purchase fetched successfully", purchase);
});
