const { apiResponse } = require("../utils/apiResponse");
const { customError } = require("../lib/CustomError");
const SizeChart = require("../models/sizeChart.model");
const { asynchandeler } = require("../lib/asyncHandeler");
const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
// create size chart
exports.createSizeChart = asynchandeler(async (req, res, next) => {
  const { name } = req.body;

  if (!name) {
    throw new customError("Name is required", 400);
  }

  // Save SizeChart first without image
  const newSizeChart = await SizeChart.create({
    name,
    image: null,
  });

  // Send immediate response
  apiResponse.sendSuccess(res, 202, "Size chart creation started", {
    newSizeChart,
  });

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
          "✅ Size chart image uploaded successfully:",
          newSizeChart._id
        );
      } catch (error) {
        console.error(
          "❌ Background size chart image upload failed:",
          error.message
        );
      }
    })();
  }
});

// get all size chart
exports.getAllSizeChart = asynchandeler(async (req, res, next) => {
  const sizeChart = await SizeChart.find();
  return apiResponse.sendSuccess(res, 200, "Size chart fetched successfully", {
    sizeChart,
  });
});

// get single size chart
exports.getSizeChartBySlug = asynchandeler(async (req, res, next) => {
  const { slug } = req.params;
  const sizeChart = await SizeChart.findOne({ slug });
  if (!sizeChart) {
    throw new customError("Size chart not found", 404);
  }
  return apiResponse.sendSuccess(res, 200, "Size chart fetched successfully", {
    sizeChart,
  });
});

// update size chart
exports.updateSizeChart = asynchandeler(async (req, res, next) => {
  const { name } = req.body;
  const { slug } = req.params;

  const sizeChart = await SizeChart.findOne({ slug });
  if (!sizeChart) {
    throw new customError("Size chart not found", 404);
  }

  // Update name immediately
  sizeChart.name = name || sizeChart.name;
  await sizeChart.save();

  // Send immediate response
  apiResponse.sendSuccess(res, 202, "Size chart update started", { sizeChart });

  // Background image delete/upload
  if (req.files?.image && req.files.image.length > 0) {
    (async () => {
      try {
        // Delete old image
        if (sizeChart.image?.public_id) {
          await deleteCloudinaryFile(sizeChart.image.public_id);
          console.log(
            "✅ Old size chart image deleted:",
            sizeChart.image.public_id
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
          sizeChart._id
        );
      } catch (error) {
        console.error(
          "❌ Background size chart image update failed:",
          error.message
        );
      }
    })();
  }
});

//@desc delete size chart by slug
exports.deleteSizeChartBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const sizeChart = await SizeChart.findOne({ slug });
  if (!sizeChart) {
    throw new customError("Size chart not found", 404);
  }

  // ✅ Send immediate response
  apiResponse.sendSuccess(res, 202, "Size chart deletion started", sizeChart);

  // ✅ Background delete
  (async () => {
    try {
      // Delete image from Cloudinary if exists
      if (sizeChart.image?.public_id) {
        await deleteCloudinaryFile(sizeChart.image.public_id);
        console.log("✅ Size chart image deleted:", sizeChart.image.public_id);
      }

      // Delete the document from DB
      await SizeChart.deleteOne({ slug });
      console.log("✅ Size chart document deleted:", slug);
    } catch (error) {
      console.error("❌ Background size chart deletion failed:", error.message);
    }
  })();
});
