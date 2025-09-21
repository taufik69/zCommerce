const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");

const Discount = require("../models/discount.model");
const Category = require("../models/category.model");
const Subcategory = require("../models/subcategory.model");
const Product = require("../models/product.model");
const validateDiscount = require("../validation/discount.validation");

// @desc create a new discount
exports.createDiscount = asynchandeler(async (req, res) => {
  const value = await validateDiscount(req);

  // create a new discount
  const discount = new Discount(value);

  await discount.save();

  // if category exist then add discount id into category model
  const category = await Category.findById(value.category);
  if (category) {
    category.discount = discount._id;
    await category.save();
  }
  // if subcategory exist then add discount id into subcategory model
  const subcategory = await Subcategory.findById(value.subCategory);
  if (subcategory) {
    subcategory.discount = discount._id;
    await subcategory.save();
  }
  // if product exist then add discount id into product model
  const product = await Product.findById(value.product);
  if (product) {
    product.discount = discount._id;
    await product.save();
  }

  // if discount plan is flat then set discount value set the the discountValueByAmount and discountValueByPercentance to the every product

  if (value.discountPlan === "flat") {
    const products = await Product.find();
    for (const product of products) {
      product.discount = discount._id;
      await product.save();
    }
  }

  return apiResponse.sendSuccess(
    res,
    201,
    "Discount created successfully",
    discount
  );
});

// @desc get all discounts
exports.getAllDiscounts = asynchandeler(async (req, res) => {
  const discounts = await Discount.find()
    .populate("category subCategory product")
    .sort({ createdAt: -1 });

  // serial add করা
  const discountsWithSerial = discounts.map((d, index) => {
    const serialNumber = (index + 1).toString().padStart(6, "0");
    return {
      serial: `DISC-${serialNumber}`, // prefix = DISC-${serialNumber}
      ...d.toObject(),
    };
  });
  return apiResponse.sendSuccess(
    res,
    200,
    "Discounts fetched successfully",
    discountsWithSerial
  );
});

// @desc search discount with the help of slug
exports.getDiscountBySlug = asynchandeler(async (req, res) => {
  const slug = req.params.slug;
  const discount = await Discount.findOne({ slug }).populate(
    "category subCategory product"
  );
  if (!discount) {
    throw new customError("Discount not found", 404);
  }
  apiResponse.sendSuccess(res, 200, "Discount fetched successfully", discount);
});

// @desc update a discount by slug
exports.updateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const updates = req.body;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // if category exist then add discount id into category model
  const category = await Category.findById(updates.category);

  if (category) {
    // first remove the previous discount id
    await Category.updateOne(
      { _id: discount.category },
      { $set: { discount: null } }
    );
    category.discount = discount._id;
    await category.save();
  }
  // if subcategory exist then add discount id into subcategory model
  const subcategory = await Subcategory.findById(updates.subCategory);
  if (subcategory) {
    await Subcategory.updateOne(
      { _id: discount.subCategory },
      { $set: { discount: null } }
    );
    subcategory.discount = discount._id;
    await subcategory.save();
  }
  // if product exist then add discount id into product model
  const product = await Product.findById(updates.product);
  if (product) {
    await Product.updateOne(
      { _id: discount.product },
      { $set: { discount: null } }
    );
    product.discount = discount._id;
    await product.save();
  }

  // Update only the fields provided in the request body
  Object.keys(updates).forEach((key) => {
    discount[key] = updates[key];
  });
  // Save the updated discount to the database
  await discount.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    200,
    "Discount updated successfully",
    discount
  );
});

// @desc deactivate a discount by slug
exports.deactivateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: true });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // Deactivate the discount
  discount.isActive = false;
  await discount.save();

  // Send success response
  apiResponse.sendSuccess(
    res,
    200,
    "Discount deactivated successfully",
    discount
  );
});

//@desc pagination form discount
exports.getDiscountPagination = asynchandeler(async (req, res) => {
  const { limit, page } = req.query;
  const skip = (page - 1) * limit;
  const discounts = await Discount.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate("category subCategory product");
  const total = await Discount.countDocuments();
  const totalPages = Math.ceil(total / limit);

  apiResponse.sendSuccess(res, 200, "Discounts fetched successfully", {
    discounts,
    page: parseInt(page),
    limit: parseInt(limit),
    total: parseInt(total),
    totalPages: parseInt(totalPages),
  });
});

// @desc active discount  by slug
exports.activateDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.query;

  // Find the discount by slug
  const discount = await Discount.findOne({ slug, isActive: false });
  if (!discount) {
    throw new customError("Discount not found", 404);
  }

  // Activate the discount
  discount.isActive = true;
  await discount.save();

  // Send success response
  apiResponse.sendSuccess(
    res,
    200,
    "Discount activated successfully",
    discount
  );
});

// @desc  permanent delte the discount
exports.deleteDiscount = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the discount by slug
  const discount = await Discount.findOneAndDelete({ slug });
  // now delete discount id from category model
  if (!discount) {
    throw new customError("Discount not found", 404);
  }
  if (discount.category) {
    await Category.updateOne(
      { _id: discount.category },
      { $set: { discount: null } }
    );
  }

  // now delete discount id from subcategory model
  if (discount.subCategory) {
    await Subcategory.updateOne(
      { _id: discount.subCategory },
      { $set: { discount: null } }
    );
  }
  // now delete discount id from product model
  if (discount.product) {
    await Product.updateOne(
      { _id: discount.product },
      { $set: { discount: null } }
    );
  }

  // Send success response
  apiResponse.sendSuccess(res, 200, "Discount deleted successfully", discount);
});
