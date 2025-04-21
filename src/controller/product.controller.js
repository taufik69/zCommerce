const Product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const { cloudinaryFileUpload } = require("../helpers/cloudinary");
const { validateProduct } = require("../validation/product.validation");

// @desc    Create a new product
exports.ProductCreate = asynchandeler(async (req, res, next) => {
  const { name, description, category, subcategory, brand, discountId, tag } =
    validateProduct(req);

  // now upload the thumbnail and image to cloudinary

  const thumbnail = await cloudinaryFileUpload(req.files.thumbnail[0].path);

  const image = await Promise.all(
    req.files.image.map(async (file) => {
      return await cloudinaryFileUpload(file.path);
    })
  );

  // now create the product

  const product = await Product.create({
    name,
    description,
    category,
    subcategory,
    brand,
    discountId,
    tag: tag ? tag : [],
    thumbnail: thumbnail.optimizeUrl,
    image: image.map((img) => img.optimizeUrl),
  });

  // now send the response
  return apiResponse.sendSuccess(
    res,
    201,
    "Product created successfully",
    product
  );
});

// @desc    Get all products
exports.getAllProducts = asynchandeler(async (req, res, next) => {
  const products = await Product.find({ isActive: true })
    .populate({
      path: "category",
      select: "-createdAt -updatedAt ",
    })
    .populate({
      path: "subcategory",
      select: "-createdAt -updatedAt",
    })
    .populate({
      path: "brand",
      select: "-createdAt -updatedAt",
    });

  return apiResponse.sendSuccess(res, 200, "Products fetched successfully", {
    count: products.length,
    data: products,
  });
});

// @desc    Get a single product by slug
exports.getSingleProduct = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug, isActive: true })
    .populate({
      path: "category",
      select: "-createdAt -updatedAt ",
    })
    .populate({
      path: "subcategory",
      select: "-createdAt -updatedAt",
    })
    .populate({
      path: "brand",
      select: "-createdAt -updatedAt",
    });
  if (!product) {
    throw new customError("Product not found", 404);
  }
  return apiResponse.sendSuccess(
    res,
    200,
    "Product fetched successfully",
    product
  );
});
