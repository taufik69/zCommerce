require("dotenv").config();
const bwipjs = require("bwip-js");
const QRCode = require("qrcode");
const Product = require("../models/product.model");
const variant = require("../models/variant.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");

const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
  uploadBarcodeToCloudinary,
} = require("../helpers/cloudinary");
const { validateProduct } = require("../validation/product.validation");
const { populate } = require("../models/purchase.model");
const { statusCodes } = require("../constant/constant");

// Create a new product (only required fields)
exports.createProduct = asynchandeler(async (req, res) => {
  //  Step 1: Validate required fields
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
    variantType,
    specifications,
  } = value;

  //  Create basic product first (without images & QR)
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
    variantType,
    specifications,
    ...req.body,
  });

  await product.save();

  //  Step 3: Send immediate response
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Product creation is being processed in the background",
    { productId: product._id },
  );

  //  Step 4: Background processing (fire-and-forget)
  (async () => {
    try {
      // Upload images if provided
      let imageUrls = [];
      if (req.files?.image?.length) {
        const imageUploads = await Promise.all(
          req.files.image.map((file) => cloudinaryFileUpload(file.path)),
        );
        imageUrls = imageUploads.map((img) => img.optimizeUrl);
        product.image = imageUrls;
      }

      // Generate QR code
      const qrCodeBuffer = await QRCode.toBuffer(
        JSON.stringify(
          `${
            process.env.PRODUCT_QR_URL ||
            "https://www.facebook.com/zahirulislamdev"
          }`,
        ),
        {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 200,
          height: 200,
          type: "png",
        },
      );

      const base64qrCode = `data:image/png;base64,${qrCodeBuffer.toString(
        "base64",
      )}`;
      const { optimizeUrl: qrCodeUrl } =
        await uploadBarcodeToCloudinary(base64qrCode);
      product.qrCode = qrCodeUrl || null;

      // Save product with images & QR
      await product.save();
      console.log(`✅ Background product creation completed: ${product._id}`);
    } catch (error) {
      console.error(
        `❌ Background product creation failed: ${product._id}`,
        error.message,
      );
    }
  })();
});

// @desc Get all products with optional filters
exports.getAllProducts = asynchandeler(async (req, res) => {
  const { category, subcategory, brand, minPrice, maxPrice } = req.query;

  const query = {};
  if (category) query.category = category;
  if (subcategory) query.subcategory = subcategory;
  if (brand) query.brand = brand;

  // Price filtering
  const priceFilter = {};
  if (minPrice) priceFilter.$gte = parseFloat(minPrice);
  if (maxPrice) priceFilter.$lte = parseFloat(maxPrice);

  // Fetch products first
  const products = await Product.find(query)
    .populate({
      path: "variant",
      populate: "stockVariantAdjust product",
    })
    .populate({
      path: "byReturn",
      populate: "product variant",
    })
    .populate({
      path: "salesReturn",
      populate: "product variant",
    })
    .populate("category brand  discount stockAdjustment")
    .populate({
      path: "category",
      populate: "discount",
    })
    .populate({
      path: "subcategory",
      populate: "discount",
    })
    .select("-updatedAt -createdAt");

  // Now filter based on price (after population)
  const filteredProducts = products.filter((product) => {
    // Single variant
    if (product.variantType === "singleVariant") {
      if (Object.keys(priceFilter).length === 0) return true;
      const price = product.retailPrice || 0;
      if (priceFilter.$gte && price < priceFilter.$gte) return false;
      if (priceFilter.$lte && price > priceFilter.$lte) return false;
      return true;
    }

    // Multiple variant
    if (
      product.variantType === "multipleVariant" &&
      Array.isArray(product.variant)
    ) {
      return product.variant.some((v) => {
        const price = v.retailPrice || 0;
        if (priceFilter.$gte && price < priceFilter.$gte) return false;
        if (priceFilter.$lte && price > priceFilter.$lte) return false;
        return true;
      });
    }

    return true;
  });

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Products fetched successfully",
    filteredProducts,
  );
});

//@desc Get product by slug
exports.getProductBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug })
    .populate({
      path: "variant",
      populate: "stockVariantAdjust product",
    })
    .populate({
      path: "byReturn",
      populate: "product variant",
    })
    .populate({
      path: "salesReturn",
      populate: "product variant",
    })
    .populate("brand  discount stockAdjustment")
    .populate({
      path: "category",
      populate: "discount",
    })
    .populate({
      path: "subcategory",
      populate: "discount",
    });

  if (!product) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product fetched successfully",
    product,
  );
});

//@desc Update product by slug and when update name then change the sku as well as qrCode and barcode
exports.updateProductInfoBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOneAndUpdate(
    { slug },
    { ...req.body },
    {
      new: true,
    },
  ).populate("category subcategory brand variant discount");

  if (!product) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product updated successfully",
    product,
  );
});

//@desc Add images to product by slug
exports.addProductImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOne({ slug });
  if (!product) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Product not found",
    );
  }

  // Step 1: Validate files
  if (!req.files || !req.files.image || req.files.image.length === 0) {
    return apiResponse.sendError(
      res,
      statusCodes.BAD_REQUEST,
      "No image files provided",
    );
  }

  //  Step 2: Send immediate response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Image upload is being processed in the background",
    { slug },
  );

  //  Step 3: Background processing
  (async () => {
    try {
      const imageUploads = await Promise.all(
        req.files.image.map((file) => cloudinaryFileUpload(file.path)),
      );
      const newImageUrls = imageUploads.map((img) => img.optimizeUrl);

      product.image = [...product.image, ...newImageUrls];
      await product.save();

      console.log(`✅ Background images added to product: ${product._id}`);
    } catch (error) {
      console.error(
        `❌ Background image upload failed for product: ${product._id}`,
        error.message,
      );
    }
  })();
});

//@desc find the product by slug and select image and send image urls and delte this image from cloudinary
exports.deleteProductImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  let { imageUrl } = req.body;

  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }

  //  Step 1: Normalize imageUrl to array
  if (!Array.isArray(imageUrl)) {
    imageUrl = [imageUrl];
  }

  //  Step 2: Send immediate response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Image deletion is being processed in the background",
    { slug },
  );

  //  Step 3: Background processing
  (async () => {
    try {
      for (const url of imageUrl) {
        const match = url.split("/");
        const publicId = match[match.length - 1].split(".")[0]; // Extract public ID

        if (!publicId) {
          console.warn(
            `⚠️ Invalid image URL: ${url} for product: ${product._id}`,
          );
          continue;
        }

        await deleteCloudinaryFile(publicId.split("?")[0]);
        product.image = product.image.filter((img) => img !== url);
      }

      await product.save();
      console.log(` Background images deleted for product: ${product._id}`);
    } catch (error) {
      console.error(
        `❌ Background image deletion failed for product: ${product._id}`,
        error.message,
      );
    }
  })();
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
  if (!products || products.length === 0) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product fetched successfully",
    products,
  );
});

//@desc delete product by slug and whenn delete product then delete all images from cloudinary
exports.deleteProductBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const product = await Product.findOneAndDelete({ slug });
  if (!product) {
    return apiResponse.sendError(
      res,
      statusCodes.NOT_FOUND,
      "Product not found",
    );
  }

  //  Step 1: Send immediate response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product deletion is being processed in the background",
    { slug },
  );

  //  Step 2: Background processing
  (async () => {
    try {
      // Delete all images from Cloudinary
      if (product.image && product.image.length > 0) {
        await Promise.all(
          product.image.map(async (imgUrl) => {
            const match = imgUrl.split("/");
            const publicId = match[match.length - 1].split(".")[0];
            if (publicId) {
              await deleteCloudinaryFile(publicId.split("?")[0]);
              console.log(`🗑️ Deleted Cloudinary image: ${publicId}`);
            } else {
              console.warn(`⚠️ Invalid image URL for product: ${product._id}`);
            }
          }),
        );
      }

      console.log(`✅ Background product deletion completed: ${slug}`);
    } catch (error) {
      console.error(
        `❌ Background product deletion failed: ${slug}`,
        error.message,
      );
    }
  })();
});

// @desc get product review by slug
exports.getProductReviewBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug })
    .select("reviews")
    .populate("reviews.reviewer", "name email image phone");
  if (!product) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product fetched successfully",
    product,
  );
});

// @desc update product review by slug
exports.updateProductReviewBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }
  product.reviews.push(req.body);
  await product.save();
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product review updated successfully",
    product,
  );
});

//@desc remove product review by slug
exports.removeProductReviewBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const product = await Product.findOne({ slug });
  if (!product) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }
  product.reviews = product.reviews.filter(
    (review) => review._id.toString() !== req.body.id,
  );
  await product.save();
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Product review removed successfully",
    product,
  );
});

// @desc get all multiple variant products
exports.getAllMultipleVariantProducts = asynchandeler(async (req, res) => {
  const products = await Product.find({ variantType: "multipleVariant" })
    .populate("category subcategory brand variant discount")
    .sort({ createdAt: -1 });

  if (!products || products.length === 0) {
    throw new customError(
      "Multiple variant products not found",
      statusCodes.NOT_FOUND,
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Multiple variant products fetched successfully",
    products,
  );
});

// @desc new arrival product
exports.getNewArrivalProducts = asynchandeler(async (req, res) => {
  const products = await Product.find({})
    .sort({ createdAt: -1 })
    .populate("brand variant discount")
    .populate({
      path: "category",
      populate: "discount",
    })
    .populate({
      path: "subcategory",
      populate: "discount",
    })
    .limit(20);

  if (!products || products.length === 0) {
    throw new customError(
      "New arrival products not found",
      statusCodes.NOT_FOUND,
    );
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "New arrival products fetched successfully",
    products,
  );
});

//@desc product price range filter
exports.getProductsByPriceRange = asynchandeler(async (req, res) => {
  let { minPrice, maxPrice } = req.query;
  minPrice = Number(minPrice);
  maxPrice = Number(maxPrice);

  if (isNaN(minPrice) || isNaN(maxPrice)) {
    throw new customError("Invalid price range", statusCodes.BAD_REQUEST);
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
          { retailPrice: { $gte: minPrice, $lte: maxPrice } },

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

  if (!products || products.length === 0) {
    throw new customError("Products not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Products fetched successfully",
    products,
  );
});

//@desc  get related product
exports.getRelatedProducts = asynchandeler(async (req, res) => {
  const { category } = req.body;
  const products = await Product.find({
    category,
  })
    .populate("category subcategory brand variant discount")
    .sort({ createdAt: -1 });
  if (!products || products.length === 0) {
    throw new customError("Products not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Products fetched successfully",
    products,
  );
});

//@desc   discount product
// Get all Discounted Products (Product + Variant)
exports.getDiscountProducts = asynchandeler(async (req, res) => {
  // ==============================
  // 1️⃣ Find discounted main products
  // ==============================
  const products = await Product.find({ discount: { $ne: null } })
    .populate("brand variant discount")
    .populate({
      path: "category",
      populate: "discount",
    })
    .populate({
      path: "subcategory",
      populate: "discount",
    })
    .sort({ createdAt: -1 });

  if (!products || products.length === 0) {
    throw new customError(
      "Discounted products not found",
      statusCodes.NOT_FOUND,
    );
  }
  // ==============================
  // 2️ Find discounted variant products
  // ==============================
  const variantDiscountedProducts = await variant
    .find({ discount: { $ne: null } })
    .sort({ createdAt: -1 })
    .populate({
      path: "product",
      populate: [
        { path: "category", populate: "discount" },
        { path: "subcategory", populate: "discount" },
        { path: "brand", populate: "discount" },
      ],
      select: "-variant",
    });

  if (!variantDiscountedProducts || variantDiscountedProducts.length === 0) {
    throw new customError(
      "Discounted variant products not found",
      statusCodes.NOT_FOUND,
    );
  }

  // =============================
  // 3️⃣Merge both product lists
  // ==============================
  const allDiscountedProducts = [...products, ...variantDiscountedProducts];

  // ==============================
  // 4️⃣ Send success response
  // ==============================
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Discounted products fetched successfully",
    allDiscountedProducts,
  );
});

//@desc get bestSellig product
exports.getBestSellingProducts = asynchandeler(async (_, res) => {
  const products = await Product.find({
    totalSales: { $gt: 1 },
  })
    .sort({ totalSales: -1 })
    .populate("brand variant discount")
    .populate({
      path: "category",
      populate: "discount",
    })
    .populate({
      path: "subcategory",
      populate: "discount",
    })
    .limit(10);

  if (!products || products.length === 0) {
    throw new customError(
      "Best selling products not found",
      statusCodes.NOT_FOUND,
    );
  }

  // now find the variant products which are best selling
  const variantBestSellingProducts = await variant
    .find({
      totalSales: { $gt: 1 },
    })
    .sort({ totalSales: -1 })
    .populate({
      path: "product",
      // populate: [
      //   {
      //     path: "category",
      //     populate: "discount",
      //   },
      //   {
      //     path: "subcategory",
      //     populate: "discount",
      //   },
      //   {
      //     path: "brand",
      //     populate: "discount",
      //   },
      // ],
      select: "-variant",
    })

    .limit(50);

  if (!variantBestSellingProducts || variantBestSellingProducts.length === 0) {
    throw new customError(
      "Best selling variant products not found",
      statusCodes.NOT_FOUND,
    );
  }
  products.push(...variantBestSellingProducts);

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Best selling products fetched successfully",
    products,
  );
});

//@desc name wise  search
exports.getNameWiseSearch = asynchandeler(async (req, res) => {
  const { name = "", barCode = "" } = req.query;
  console.log("Search Query:", { name, barCode });

  // Build match conditions dynamically
  const matchConditions = [];

  if (name) {
    matchConditions.push(
      { name: { $regex: name, $options: "i" } },
      { "variant.variantName": { $regex: name, $options: "i" } },
    );
  }

  if (barCode) {
    matchConditions.push({
      barCode: { $regex: barCode, $options: "i" },
    });
  }

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
        $or: matchConditions.length > 0 ? matchConditions : [{}], // prevents empty $or error
      },
    },
  ]);

  if (products.length === 0) {
    throw new customError("Product not found", statusCodes.NOT_FOUND);
  }

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Products fetched successfully",
    products,
  );
});
