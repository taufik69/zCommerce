const Product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { validateProduct } = require("../validation/product.validation");

// @desc    Create a new product
exports.ProductCreate = asynchandeler(async (req, res, next) => {
  const { name, description, category, subcategory, brand, discountId, tag } =
    await validateProduct(req);

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
    })
    .populate({
      path: "discountId",
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
    })
    .populate({
      path: "discountId",
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

// @desc    Update a product by slug only text fields update not image
exports.updateProductInfo = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const { name, description, category, subcategory, brand, discountId, tag } =
    req.body;

  // manually check the req.body
  if (!name || !description || !category || !subcategory || !brand) {
    throw new customError("Please provide all required fields", 400);
  }

  // check if product exists
  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError("Product not found", 404);
  }

  // update the product
  product.name = name;
  product.description = description;
  product.category = category;
  product.subcategory = subcategory;
  product.brand = brand;
  product.discountId = discountId;
  product.tag = tag ? tag : [];

  await product.save();

  return apiResponse.sendSuccess(
    res,
    200,
    "Product updated successfully",
    product
  );
});

// @desc update product thumbnail and images when upload new image and thumbnail then delete old images from cloudinary
exports.updateProductImages = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError("Product not found", 404);
  }

  if (!req.files) {
    throw new customError("Please provide at least one image", 400);
  }
  if (
    req.files.image[0].fieldname !== "image" ||
    req.files.thumbnail[0].fieldname !== "thumbnail"
  ) {
    throw new customError(
      "Please provide a valid image name fieldName (image || thumbnail)",
      400
    );
  }
  if (req.files.thumbnail.length > 1) {
    throw new customError("You can upload a maximum of 1 thumbnail", 400);
  }
  if (req.files.image.length > 15) {
    throw new customError("You can upload a maximum of 15 images", 400);
  }

  // Delete the old thumbnail from Cloudinary
  if (product.thumbnail) {
    const regex = /\/([a-zA-Z0-9_-]+)\?/; // Regex to extract the public ID
    const match = product.thumbnail.match(regex);
    const publicId = match ? match[1] : null;

    if (!publicId) {
      throw new customError("Invalid thumbnail URL", 400);
    }

    await deleteCloudinaryFile(publicId);
  }

  // Delete the old images from Cloudinary
  if (product.image && product.image.length > 0) {
    const deletePromises = product.image.map(async (imageUrl) => {
      const regex = /\/([a-zA-Z0-9_-]+)\?/;
      const match = imageUrl.match(regex);
      const publicId = match ? match[1] : null;

      if (!publicId) {
        throw new customError("Invalid image URL", 400);
      }

      await deleteCloudinaryFile(publicId);
    });

    await Promise.all(deletePromises);
  }

  // Upload the new thumbnail to Cloudinary
  const thumbnail = await cloudinaryFileUpload(req.files.thumbnail[0].path);

  // Upload the new images to Cloudinary
  const image = await Promise.all(
    req.files.image.map(async (file) => {
      const result = await cloudinaryFileUpload(file.path);
      return result.optimizeUrl; // Return the optimized URL
    })
  );

  // Update the product in the database
  product.thumbnail = thumbnail.optimizeUrl;
  product.image = image;
  await product.save();

  // Send success response
  return apiResponse.sendSuccess(
    res,
    200,
    "Product images updated successfully",
    product
  );
});

//@desc pagination product with the help of query parmas
exports.getProductsPagination = asynchandeler(async (req, res, next) => {
  const { limit, page } = req.query;
  const query = { isActive: true };
  const skip = (page - 1) * limit;
  const products = await Product.find(query)
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });
  const total = await Product.countDocuments(query);
  const totalPages = Math.ceil(total / limit);

  return apiResponse.sendSuccess(res, 200, "Products fetched successfully", {
    products,
    page,
    limit,
    total,
    totalPages,
  });
});

// @desc get all products with sort
exports.getAllProductsInOrder = asynchandeler(async (req, res, next) => {
  const { sortBy } = req.query;
  const query = { isActive: true };

  // Determine the sort order
  const sortOrder = sortBy === "asc" ? 1 : -1;

  // Fetch products with sorting
  const products = await Product.find(query)
    .sort({ createdAt: sortOrder })
    .populate(["category", "subcategory", "brand", "discountId"]);

  return apiResponse.sendSuccess(
    res,
    200,
    "Products fetched successfully",
    products
  );
});

// @desc search product with name using req.query
exports.searchProductByName = asynchandeler(async (req, res, next) => {
  const { search } = req.query;
  const query = {
    $or: [
      { name: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ],
    isActive: true,
  };

  const products = await Product.find(query).populate([
    "category",
    "subcategory",
    "brand",
    "discountId",
  ]);

  return apiResponse.sendSuccess(
    res,
    200,
    "Products fetched successfully",
    products
  );
});
