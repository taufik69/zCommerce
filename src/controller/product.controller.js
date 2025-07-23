const Product = require("../models/product.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");

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
    wholesalePrice,
    retailPrice,
    warrantyInformation,
    manufactureCountry,
    stock,
    size,
    color,
  } = value;

  // Generate SKU based on name, color, size, and timestamp

  const namePrefix = name?.slice(0, 3).toUpperCase() || "NON";
  const colorPrefix = color[0]?.slice(0, 2).toUpperCase() || "CL";
  const sizePrefix = size[0]?.toString().toUpperCase() || "SZ";
  const timestamp = Date.now().toString().slice(-6);
  const sku = `${namePrefix}-${colorPrefix}-${sizePrefix}-${timestamp}`;

  // make a qr code for product
  const qrCodeData = {
    name,
    brand,
    retailPrice,
  };

  const qrCode = await QRCode.toBuffer(JSON.stringify(qrCodeData), {
    errorCorrectionLevel: "H",
  });
  const base64qrCode = `data:image/png;base64,${qrCode.toString("base64")}`;

  // upload qr code to cloudinary
  const { optimizeUrl: qrCodeUrl } = await uploadBarcodeToCloudinary(
    base64qrCode
  );

  // Generate barcode using bwip-js
  const barcode = await bwipjs.toBuffer({
    bcid: "code128",
    text: sku,
    scale: 3,
    height: 10,
    includetext: true,
    textxalign: "center",
    backgroundcolor: "FFFFFF",
    // No need for output: 'svg'
  });

  const base64Barcode = `data:image/png;base64,${barcode.toString("base64")}`;
  // upload barcode to cloudinary
  const { optimizeUrl: barcodeUrl } = await uploadBarcodeToCloudinary(
    base64Barcode
  );

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
    qrCode: qrCodeUrl || null,
    barCode: barcodeUrl || null,
    sku,
    description,
    category,
    subcategory,
    brand,
    size,
    color,
    wholesalePrice,
    retailPrice,
    warrantyInformation,
    manufactureCountry,
    stock,
    image: imageUrls,
    ...req.body,
  });

  await product.save();

  apiResponse.sendSuccess(res, 201, "Product created successfully", product);
});

//@desc Get all porducts using pipeline aggregation
exports.getAllProducts = asynchandeler(async (req, res) => {
  const products = await Product.aggregate([
    {
      $lookup: {
        from: "categories",
        localField: "category",
        foreignField: "_id",
        as: "categoryDetails",
      },
    },
    {
      $unwind: {
        path: "$categoryDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "subcategory",
        foreignField: "_id",
        as: "subcategoryDetails",
      },
    },
    {
      $unwind: {
        path: "$subcategoryDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "brand",
        foreignField: "_id",
        as: "brandDetails",
      },
    },
    {
      $unwind: {
        path: "$brandDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "variants",
        localField: "_id",
        foreignField: "product",
        as: "variants",
      },
    },
    {
      $unwind: {
        path: "$variants",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $lookup: {
        from: "discounts",
        localField: "discount",
        foreignField: "_id",
        as: "discountDetails",
      },
    },
    {
      $unwind: {
        path: "$discountDetails",
        preserveNullAndEmptyArrays: true,
      },
    },
    {
      $sort: { createdAt: -1 }, // Sort by createdAt in descending order
    },
  ]);
  apiResponse.sendSuccess(res, 200, "Products fetched successfully", products);
});

//@desc Get product by slug
exports.getProductBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug }).populate(
    "category subcategory brand variant discount"
  );
  if (!product) {
    throw new customError(404, "Product not found");
  }
  apiResponse.sendSuccess(res, 200, "Product fetched successfully", product);
});

//@desc Update product by slug and when update name then change the sku as well as qrCode and barcode
exports.updateProductInfoBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({ slug });

  if (!product) {
    throw new customError(404, "Product not found");
  }

  if (req?.body?.name || req?.body?.color || req?.body?.size) {
    // ✅ DELETE PREVIOUS QR CODE
    if (product.qrCode) {
      const match = product.qrCode.split("/");
      const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL
      const qrCodePublicId = publicId.split("?")[0]; // Remove any query parameters
      if (qrCodePublicId) {
        await deleteCloudinaryFile(qrCodePublicId);
      }
    }

    // ✅ DELETE PREVIOUS BARCODE
    if (product.barCode) {
      // Match the regex and extract the ID
      const match = product.barCode.split("/");
      const publicId = match[match.length - 1].split(".")[0]; // Extract public ID from URL

      if (publicId) {
        await deleteCloudinaryFile(publicId.split("?")[0]);
      }
    }

    // ✅ GENERATE SKU
    const name = req.body.name;
    const color = req.body.color || product.color;
    const size = req.body.size || product.size;

    const namePrefix = name?.slice(0, 3).toUpperCase() || "NON";
    const colorPrefix = color?.slice(0, 2).toUpperCase() || "CL";
    const sizePrefix = size?.toString().toUpperCase() || "SZ";
    const timestamp = Date.now().toString().slice(-6);
    const sku = `${namePrefix}-${colorPrefix}-${sizePrefix}-${timestamp}`;

    // ✅ GENERATE QR CODE
    const qrCodeData = {
      name,
      brand: req.body.brand || product.brand,
      retailPrice: req.body.retailPrice || product.retailPrice,
    };

    const qrCode = await QRCode.toBuffer(JSON.stringify(qrCodeData), {
      errorCorrectionLevel: "H",
    });
    const base64qrCode = `data:image/png;base64,${qrCode.toString("base64")}`;

    const { optimizeUrl: qrCodeUrl } = await uploadBarcodeToCloudinary(
      base64qrCode
    );

    // ✅ GENERATE BARCODE
    const barcode = await bwipjs.toBuffer({
      bcid: "code128",
      text: sku,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: "center",
      backgroundcolor: "FFFFFF",
    });

    const base64Barcode = `data:image/png;base64,${barcode.toString("base64")}`;

    const { optimizeUrl: barcodeUrl } = await uploadBarcodeToCloudinary(
      base64Barcode
    );

    // ✅ SET NEW DATA
    product.name = req.body.name || product.name;
    product.color = req.body.color || product.color;
    product.size = req.body.size || product.size;
    product.sku = sku;
    product.qrCode = qrCodeUrl || null;
    product.barCode = barcodeUrl || null;
  }
  if (req?.body.tag) {
    product.tag = req.body.tag;
  }

  // ✅ UPDATE OTHER FIELDS
  Object.keys(req.body).forEach((key) => {
    if (!["name", "color", "size", "tag"].includes(key)) {
      product[key] = req.body[key] || product[key];
    }
  });

  await product.save();

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
  const product = await Product.findOne({ slug }).select("reviews ");
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
