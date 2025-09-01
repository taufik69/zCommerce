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
  const image = req.files.image;
  const sizeChart = await cloudinaryFileUpload(image[0]?.path);
  if (!sizeChart) {
    throw new customError("Image is required", 400);
  }

  const newSizeChart = await SizeChart.create({
    name,
    image: {
      public_id: sizeChart.result.public_id,
      url: sizeChart.result.url,
    },
  });

  return apiResponse.sendSuccess(res, 200, "Size chart created successfully", {
    newSizeChart,
  });
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
  if (req.files.image) {
    // remove old image
    const imageUrl = sizeChart?.image?.public_id;
    const confirm = await deleteCloudinaryFile(imageUrl);
    if (!confirm) {
      throw new customError("Image not deleted", 400);
    }
    // upload new image
    const image = req.files.image;
    const sizeChartImage = await cloudinaryFileUpload(image[0]?.path);
    if (!sizeChartImage) {
      throw new customError("Image is required", 400);
    }

    sizeChart.image = {
      public_id: sizeChartImage.result.public_id,
      url: sizeChartImage.result.url,
    };
  }

  // update size chart
  sizeChart.name = name || sizeChart.name;

  await sizeChart.save();

  return apiResponse.sendSuccess(res, 200, "Size chart updated successfully", {
    sizeChart,
  });
});

//@desc delete size chart by slug
exports.deleteSizeChartBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const sizeChart = await SizeChart.findOne({ slug });
  if (!sizeChart) {
    throw new customError("Size chart not found", 404);
  }
  // remove old image
  const imageUrl = sizeChart?.image?.public_id;
  const confirm = await deleteCloudinaryFile(imageUrl);
  if (!confirm) {
    throw new customError("Image not deleted", 400);
  }
  await SizeChart.deleteOne({ slug });
  apiResponse.sendSuccess(
    res,
    200,
    "Size chart deleted successfully",
    sizeChart
  );
});
