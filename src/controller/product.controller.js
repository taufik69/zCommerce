require("dotenv").config();
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const Product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");

const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
  uploadBarcodeToCloudinary,
} = require("../helpers/cloudinary");
const { validateProduct } = require("../validation/product.validation");

// Create a new product (only required fields)
exports.createProduct = asynchandeler(async (req, res) => {
  // Validate required fields
  const value = await validateProduct(req);
  const {
    name,
    description,
    category,
    subcategory,
    brand,
    sku,
    purchasePrice,
    wholesalePrice,
    retailPrice,
    warrantyInformation,
    manufactureCountry,
    stock,
    size,
    color,
    barCode,
  } = value;

  // Generate barcode using bwip-js
  // const barcode = await bwipjs.toBuffer({
  //   bcid: "code128",
  //   text: `${sku}-${Date.now()}`.toLocaleUpperCase().slice(0, 13), // Unique identifier
  //   scale: 3,
  //   height: 10,
  //   includetext: true,
  //   textxalign: "center",
  //   backgroundcolor: "FFFFFF",
  //   // No need for output: 'svg'
  // });

  // const base64Barcode = `data:image/png;base64,${barcode.toString("base64")}`;
  // // upload barcode to cloudinary
  // const { optimizeUrl: barcodeUrl } = await uploadBarcodeToCloudinary(
  //   base64Barcode
  // );

  // upload images to cloudinary
  const imageUploads = req.files.image
    ? await Promise.all(
        req.files.image.map((file) => cloudinaryFileUpload(file.path))
      )
    : [];
  const imageUrls = imageUploads.map((img) => img.optimizeUrl);

  // Create product
  const product = new Product({
    name,
    barCode: barCode || `${Date.now()}`.toLocaleUpperCase().slice(0, 13),
    sku,
    description,
    category,
    subcategory,
    brand,
    size,
    color,
    purchasePrice,
    wholesalePrice,
    retailPrice,
    warrantyInformation,
    manufactureCountry,
    stock,
    image: imageUrls,
    ...req.body,
  });

  await product.save();

  // now create QR code and update product with QR code

  const qrCode = await QRCode.toBuffer(
    JSON.stringify(
      `${
        process.env.PRODUCT_QR_URL || "https://www.facebook.com/zahirulislamdev"
      }`
    ), // next time add a frontend product deatil page link
    {
      errorCorrectionLevel: "H",
      margin: 2,
      width: 200,
      height: 200,
      type: "png",
    }
  );
  const base64qrCode = `data:image/png;base64,${qrCode.toString("base64")}`;

  const { optimizeUrl: qrCodeUrl } = await uploadBarcodeToCloudinary(
    base64qrCode
  );
  product.qrCode = qrCodeUrl || null;
  if (stock && size && color && sku) {
    product.variantType = "singleVariant";
  } else {
    product.variantType = "multipleVariant";
  }
  await product.save();
  // Send success response

  apiResponse.sendSuccess(res, 201, "Product created successfully", product);
});

//@desc Get all porducts using pipeline aggregation
exports.getAllProducts = asynchandeler(async (req, res) => {
  const { category, subcategory, brand, minPrice, maxPrice } = req.query;

  console.log(req.query);
  const query = {};
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (brand) query.brand = brand;
  // please do not delete this code
  // if (minPrice) query.retailPrice = { $gte: minPrice };
  // if (maxPrice) query.retailPrice = { $lte: maxPrice };
  // if (minPrice && maxPrice) {
  //   query.retailPrice = { $gte: minPrice, $lte: maxPrice };
  // }

  const products = await Product.find(query)
    // .populate({
    //   path: "category",
    //   populate: {
    //     path: "discount",
    //   },
    //   select: "-subcategories -createdAt -updatedAt",
    // })
    .populate({
      path: "variant",
      populate: "stockVariantAdjust",
    })
    .populate("category brand  subcategory discount  stockAdjustment")
    .select("-updatedAt -createdAt");

  apiResponse.sendSuccess(res, 200, "Products fetched successfully", {
    products,
  });
});

//@desc Get product by slug
exports.getProductBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug })
    .populate({
      path: "category",
      populate: {
        path: "discount",
      },
      select: "-subcategories -createdAt -updatedAt",
    })
    .populate({
      path: "variant",
      populate: "stockVariantAdjust",
    })
    .populate("brand discount subcategory stockAdjustment")
    .select("-updatedAt -createdAt");

  if (!product) {
    throw new customError(404, "Product not found");
  }
  apiResponse.sendSuccess(res, 200, "Product fetched successfully", product);
});

//@desc Update product by slug and when update name then change the sku as well as qrCode and barcode
exports.updateProductInfoBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOneAndUpdate(
    { slug },
    { ...req.body },
    {
      new: true,
    }
  ).populate("category subcategory brand variant discount");

  if (!product) {
    throw new customError(404, "Product not found");
  }

  apiResponse.sendSuccess(res, 200, "Product updated successfully", product);
});

//@desc Add images to product by slug
exports.addProductImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({ slug });
  if (!product) {
    return apiResponse.sendError(res, 404, "Product not found");
  }

  // Check if files are provided
  if (!req.files || !req.files.image || req.files.image.length === 0) {
    return apiResponse.sendError(res, 400, "No image files provided");
  }

  // Upload new images to Cloudinary
  const imageUploads = await Promise.all(
    req.files.image.map((file) => cloudinaryFileUpload(file.path))
  );
  const newImageUrls = imageUploads.map((img) => img.optimizeUrl);

  // Add new image URLs to product.image array
  product.image = [...product.image, ...newImageUrls];

  await product.save();

  apiResponse.sendSuccess(res, 200, "Image(s) added successfully", product);
});

//@desc find the product by slug and select image and send image urls and delte this image from cloudinary
exports.deleteProductImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  let { imageUrl } = req.body;

  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError(404, "Product not found");
  }

  // Support both single and multiple image URLs
  if (!Array.isArray(imageUrl)) {
    imageUrl = [imageUrl];
  }

  // Delete each image from Cloudinary and remove from product.image array
  for (const url of imageUrl) {
    const match = url.split("/");
    const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL
    if (!publicId) {
      throw new customError(400, `Invalid image URL: ${url}`);
    }

    await deleteCloudinaryFile(publicId.split("?")[0]);
    product.image = product.image.filter((img) => img !== url);
  }

  await product.save();

  apiResponse.sendSuccess(res, 200, "Image(s) deleted successfully", product);
});

//@desc  get products with pagination and sorting
exports.getProductsWithPagination = asynchandeler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  const products = await Product.find()
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 })
    .populate("category subcategory brand variant discount");
  apiResponse.sendSuccess(res, 200, "Product fetched successfully", products);
});

//@desc delete product by slug and whenn delete product then delete all images from cloudinary
exports.deleteProductBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({ slug });
  if (!product) {
    return apiResponse.sendError(res, 404, "Product not found");
  }
  // Delete all images from Cloudinary
  if (product.image && product.image.length > 0) {
    await Promise.all(
      product.image.map(async (imgUrl) => {
        const match = imgUrl.split("/");
        const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL
        if (publicId) {
          await deleteCloudinaryFile(publicId.split("?")[0]);
        }
      })
    );
  }

  await Product.deleteOne({ slug });
  apiResponse.sendSuccess(res, 200, "Product deleted successfully");
});

// @desc get product review by slug
exports.getProductReviewBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug })
    .select("reviews")
    .populate("reviews.reviewer", "name email image phone");
  if (!product) {
    throw new customError(404, "Product not found");
  }
  apiResponse.sendSuccess(res, 200, "Product fetched successfully", product);
});

// @desc update product review by slug
exports.updateProductReviewBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError(404, "Product not found");
  }
  product.reviews.push(req.body);
  await product.save();
  apiResponse.sendSuccess(
    res,
    200,
    "Product review updated successfully",
    product
  );
});

//@desc remove product review by slug
exports.removeProductReviewBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError(404, "Product not found");
  }
  product.reviews = product.reviews.filter(
    (review) => review._id.toString() !== req.body.id
  );
  await product.save();
  apiResponse.sendSuccess(
    res,
    200,
    "Product review removed successfully",
    product
  );
});

// @desc get all multiple variant products
exports.getAllMultipleVariantProducts = asynchandeler(async (req, res) => {
  const products = await Product.find({ variantType: "multipleVariant" })
    .populate("category subcategory brand variant discount")
    .sort({ createdAt: -1 });
  apiResponse.sendSuccess(
    res,
    200,
    "Multiple variant products fetched successfully",
    products
  );
});

// @desc new arrival product
exports.getNewArrivalProducts = asynchandeler(async (req, res) => {
  const products = await Product.find({})
    .sort({ createdAt: -1 })
    .populate("category subcategory brand variant discount")
    .limit(20);
  apiResponse.sendSuccess(
    res,
    200,
    "New arrival products fetched successfully",
    products
  );
});

//@desc product price range filter
exports.getProductsByPriceRange = asynchandeler(async (req, res) => {
  let { minPrice, maxPrice } = req.query;
  minPrice = Number(minPrice);
  maxPrice = Number(maxPrice);

  if (isNaN(minPrice) || isNaN(maxPrice)) {
    throw new customError("Invalid price range", 400);
  }

  const products = await Product.aggregate([
    {
      $lookup: {
        from: "variants", // Variant collection
        localField: "variant", // Product এর variant field (ObjectId[])
        foreignField: "_id", // Variant collection এর _id
        as: "variantdocs", // lookup result
      },
    },
    {
      $lookup: {
        from: "discounts", // Discount collection
        localField: "discount", // Product এর discount field (ObjectId)
        foreignField: "_id", // Discount collection এর _id
        as: "discountdocs", // lookup result
      },
    },
    {
      $match: {
        $or: [
          // 1. Product নিজেই price range এর মধ্যে
          { retailPrice: { $gte: minPrice, $lte: maxPrice } },

          // 2. Variant এর মধ্যে অন্তত ১টা price range এর মধ্যে
          {
            variantdocs: {
              $elemMatch: {
                retailPrice: { $gte: minPrice, $lte: maxPrice },
              },
            },
          },
        ],
      },
    },
  ]);

  apiResponse.sendSuccess(res, 200, "Products fetched successfully", products);
});

//@desc  get related product
exports.getRelatedProducts = asynchandeler(async (req, res) => {
  const { category } = req.body;
  const products = await Product.find({
    category,
  })
    .populate("category subcategory brand variant discount")
    .sort({ createdAt: -1 });
  apiResponse.sendSuccess(res, 200, "Products fetched successfully", products);
});

//@desc   discount product
exports.getDiscountProducts = asynchandeler(async (req, res) => {
  const products = await Product.find({ discount: { $ne: null } })
    .populate("category subcategory brand variant discount")
    .sort({ createdAt: -1 });
  apiResponse.sendSuccess(res, 200, "Products fetched successfully", products);
});

//@desc get bestSellig product
exports.getBestSellingProducts = asynchandeler(async (req, res) => {
  const products = await Product.aggregate([
    {
      $match: {
        stock: { $lte: 20 },
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "variant",
        foreignField: "_id",
        as: "variant",
      },
    },
    {
      $match: {
        "variant.stockVariant": { $lte: 40 },
      },
    },
    {
      $sort: {
        "variant.stockVariant": -1,
        createdAt: -1,
      },
    },
  ]);

  apiResponse.sendSuccess(
    res,
    200,
    "Best selling products fetched successfully",
    products
  );
});

//@desc name wise  search
exports.getNameWiseSearch = asynchandeler(async (req, res) => {
  const { name } = req.body;
  const products = await Product.aggregate([
    {
      $lookup: {
        from: "variants",
        localField: "variant",
        foreignField: "_id",
        as: "variant",
      },
    },
    {
      $lookup: {
        from: "discounts",
        localField: "discount",
        foreignField: "_id",
        as: "discount",
      },
    },
    {
      $match: {
        $or: [
          { name: { $regex: name, $options: "i" } },
          { "variant.variantName": { $regex: name, $options: "i" } },
        ],
      },
    },
  ]);
  apiResponse.sendSuccess(res, 200, "Products fetched successfully", products);
});
