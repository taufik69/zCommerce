const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const SizeChart = require("../models/sizeChart.model");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { statusCodes } = require("../constant/constant");
// create size chart
exports.createSizeChart = asynchandeler(async (req, res, next) => {
  const { subCategory } = req.body;

  if (!subCategory) {
    throw new customError(
      "subCategory id is required",
      statusCodes.BAD_REQUEST,
    );
  }

  // Save SizeChart first without image
  const newSizeChart = await SizeChart.create({
    subCategory,
    image: null,
  });

  // Send immediate response
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Size chart creation started",
    {
      newSizeChart,
    },
  );

  // Background image upload
  const image = req.files?.image;
  if (image && image.length > 0) {
    (async () => {
      try {
        const sizeChartUpload = await cloudinaryFileUpload(image[0].path);

        newSizeChart.image = {
          public_id: sizeChartUpload.result.public_id,
          url: sizeChartUpload.result.url,
        };
        await newSizeChart.save();
        console.log(
          " Size chart image uploaded successfully:",
          newSizeChart._id,
        );
      } catch (error) {
        console.error(
          "❌ Background size chart image upload failed:",
          error.message,
        );
      }
    })();
  }
});

// get all size chart
exports.getAllSizeChart = asynchandeler(async (req, res) => {
  const sizeChart = await SizeChart.find().sort({ createdAt: -1 });
  if (!sizeChart || sizeChart.length === 0) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Size chart fetched successfully",
    {
      sizeChart,
    },
  );
});

// get single size chart
exports.getSizeChartBySlug = asynchandeler(async (req, res) => {
  const { subCategory } = req.params;
  const sizeChart = await SizeChart.findOne({
    subCategory: subCategory,
  }).populate("subCategory");
  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }
  return apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Size chart fetched successfully",
    {
      sizeChart,
    },
  );
});

// update size chart
exports.updateSizeChart = asynchandeler(async (req, res, next) => {
  const { subCategoryId } = req.body;
  const { subcid } = req.params;

  const sizeChart = await SizeChart.findOne({ subCategory: subcid });
  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }

  // Update name immediately
  sizeChart.subCategory = subCategoryId || sizeChart.subCategoryId;
  await sizeChart.save();

  // Send immediate response
  apiResponse.sendSuccess(res, statusCodes.OK, "Size chart update started", {
    sizeChart,
  });

  // Background image delete/upload
  if (req.files?.image && req.files.image.length > 0) {
    (async () => {
      try {
        // Delete old image
        if (sizeChart.image?.public_id) {
          await deleteCloudinaryFile(sizeChart.image.public_id);
          console.log(
            "✅ Old size chart image deleted:",
            sizeChart.image.public_id,
          );
        }

        // Upload new image
        const image = req.files.image[0];
        const sizeChartImage = await cloudinaryFileUpload(image.path);
        sizeChart.image = {
          public_id: sizeChartImage.result.public_id,
          url: sizeChartImage.result.url,
        };
        await sizeChart.save();
        console.log(
          "✅ Size chart image uploaded successfully:",
          sizeChart._id,
        );
      } catch (error) {
        console.error(
          "❌ Background size chart image update failed:",
          error.message,
        );
      }
    })();
  }
});

//@desc delete size chart by slug
exports.deleteSizeChartBySlug = asynchandeler(async (req, res) => {
  const { subCategory } = req.params;

  const sizeChart = await SizeChart.findOne({ subCategory });
  if (!sizeChart) {
    throw new customError("Size chart not found", statusCodes.NOT_FOUND);
  }

  // ✅ Send immediate response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Size chart deletion started",
    sizeChart,
  );

  // ✅ Background delete
  (async () => {
    try {
      // Delete image from Cloudinary if exists
      if (sizeChart.image?.public_id) {
        await deleteCloudinaryFile(sizeChart.image.public_id);
        console.log("✅ Size chart image deleted:", sizeChart.image.public_id);
      }

      // Delete the document from DB
      await SizeChart.deleteOne({ subCategory: sizeChart.subCategory });
      console.log("✅ Size chart document deleted:", slug);
    } catch (error) {
      console.error("❌ Background size chart deletion failed:", error.message);
    }
  })();
});
