const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");
const SiteInformation = require("../models/siteInformation.model");
const {
  validateSiteInformation,
} = require("../validation/siteinformation.validation");

const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");

// create siteinformation
exports.createSiteInformation = asynchandeler(async (req, res) => {
  const value = await validateSiteInformation(req);
  //   upload image to cloudinary
  const { optimizeUrl } = await cloudinaryFileUpload(value.image.path);

  const siteInformation = await SiteInformation.create({
    ...value,
    image: optimizeUrl,
  });
  if (!siteInformation) {
    throw new customError("SiteInformation not created", 400);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "SiteInformation created successfully",
    siteInformation
  );
});

// get all siteinformation
exports.getAllSiteInformation = asynchandeler(async (req, res) => {
  const siteInformation = await SiteInformation.find();
  if (!siteInformation.length) {
    throw new customError("SiteInformation not found", 400);
  }
  apiResponse.sendSuccess(
    res,
    200,
    "SiteInformation fetched successfully",
    siteInformation
  );
});

// get single siteinformation using slug
exports.getSingleSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const siteInformation = await SiteInformation.findOne({ slug: slug });
  if (!siteInformation) throw new customError("SiteInformation not found", 404);
  apiResponse.sendSuccess(
    res,
    200,
    "SiteInformation fetched successfully",
    siteInformation
  );
});

// update sideinformation when user upload image then remove old image and upload new image
exports.updateSiteInformationWithImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find existing SiteInformation
  const siteInformation = await SiteInformation.findOne({ slug });
  if (!siteInformation) {
    throw new customError("SiteInformation not found", 404);
  }

  // ✅ If new image is uploaded
  if (req.file) {
    try {
      if (siteInformation.image) {
        // Extract publicId from Cloudinary URL
        const imageUrl = siteInformation.image;
        const parts = imageUrl.split("/");
        const fileName = parts[parts.length - 1];
        const publicId = fileName.split(".")[0].split("?")[0];

        // Delete old image from Cloudinary
        await deleteCloudinaryFile(publicId);
      }

      // Upload new image
      const { optimizeUrl } = await cloudinaryFileUpload(req.file.path);
      siteInformation.image = optimizeUrl;
    } catch (error) {
      throw new customError(
        "Error while updating image: " + error.message,
        400
      );
    }
  }

  // ✅ Update other fields dynamically (only if provided)
  const updatableFields = [
    "storeName",
    "propiterSlogan",
    "adress",
    "phone",
    "email",
    "businessHours",
    "footer",
    "facebookLink",
    "youtubeLink",
    "instagramLink",
  ];

  updatableFields.forEach((field) => {
    if (req.body[field]) {
      siteInformation[field] = req.body[field];
    }
  });

  // Save updated data
  await siteInformation.save();

  apiResponse.sendSuccess(
    res,
    200,
    "SiteInformation updated successfully",
    siteInformation
  );
});

exports.deleteSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the existing SiteInformation
  const siteInformation = await SiteInformation.findOne({ slug });
  if (!siteInformation) {
    throw new customError("SiteInformation not found", 404);
  }

  // ✅ Delete image from Cloudinary if exists
  if (siteInformation.image) {
    try {
      const imageUrl = siteInformation.image;
      const parts = imageUrl.split("/");
      const fileName = parts[parts.length - 1];
      const publicId = fileName.split(".")[0].split("?")[0];
      await deleteCloudinaryFile(publicId);
    } catch (error) {
      throw new customError("Error deleting image from Cloudinary", 400);
    }
  }

  // ✅ Delete the document from DB
  await SiteInformation.deleteOne({ slug });

  apiResponse.sendSuccess(
    res,
    200,
    "SiteInformation deleted successfully",
    siteInformation
  );
});
