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
const { statusCodes } = require("../constant/constant");

// create siteinformation
exports.createSiteInformation = asynchandeler(async (req, res, next) => {
  const value = await validateSiteInformation(req, res, next);

  //  Create doc first with image = null
  const siteInformation = await SiteInformation.create({
    ...value,
    image: null,
  });

  if (!siteInformation) {
    throw new customError(
      "SiteInformation not created",
      statusCodes.BAD_REQUEST,
    );
  }

  //  Send response immediately
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "SiteInformation is being processed in background...",
  );

  //  Background Upload + Update
  (async () => {
    try {
      const { optimizeUrl } = await cloudinaryFileUpload(value.image.path);

      const updatedInfo = await SiteInformation.findByIdAndUpdate(
        siteInformation._id,
        { image: optimizeUrl },
        { new: true },
      );

      console.log(" Background SiteInformation Update Completed:", updatedInfo);
    } catch (error) {
      console.error(
        "❌ Background SiteInformation image upload failed:",
        error.message,
      );
    }
  })();
});

// get all siteinformation
exports.getAllSiteInformation = asynchandeler(async (req, res) => {
  const siteInformation = await SiteInformation.find();
  if (!siteInformation.length) {
    throw new customError("SiteInformation not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SiteInformation fetched successfully",
    siteInformation,
  );
});

// get single siteinformation using slug
exports.getSingleSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const siteInformation = await SiteInformation.findOne({ slug: slug });
  if (!siteInformation)
    throw new customError("SiteInformation not found", statusCodes.NOT_FOUND);
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SiteInformation fetched successfully",
    siteInformation,
  );
});

// update sideinformation when user upload image then remove old image and upload new image
exports.updateSiteInformationWithImage = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  const siteInformation = await SiteInformation.findOne({ slug });
  if (!siteInformation) {
    throw new customError("SiteInformation not found", statusCodes.NOT_FOUND);
  }

  //  Update other fields immediately
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
    if (req.body[field]) siteInformation[field] = req.body[field];
  });

  await siteInformation.save();

  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SiteInformation update started",
    siteInformation,
  );

  //  Background image upload/delete
  if (req.file) {
    (async () => {
      try {
        if (siteInformation.image) {
          const imageUrl = siteInformation.image;
          const parts = imageUrl.split("/");
          const fileName = parts[parts.length - 1];
          const publicId = fileName.split(".")[0].split("?")[0];

          await deleteCloudinaryFile(publicId);
          console.log(" Old image deleted:", publicId);
        }

        const { optimizeUrl } = await cloudinaryFileUpload(req.file.path);
        siteInformation.image = optimizeUrl;
        await siteInformation.save();
        console.log(" New image uploaded:", optimizeUrl);
      } catch (error) {
        console.error("❌ Background image update failed:", error.message);
      }
    })();
  }
});

exports.deleteSiteInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // Find the existing SiteInformation
  const siteInformation = await SiteInformation.findOne({ slug });
  if (!siteInformation) {
    throw new customError("SiteInformation not found", statusCodes.NOT_FOUND);
  }

  // Send immediate response to client
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "SiteInformation deletion started",
    siteInformation,
  );

  // Background delete
  (async () => {
    try {
      // Delete image from Cloudinary if exists
      if (siteInformation.image) {
        const imageUrl = siteInformation.image;
        const parts = imageUrl.split("/");
        const fileName = parts[parts.length - 1];
        const publicId = fileName.split(".")[0].split("?")[0];

        await deleteCloudinaryFile(publicId);
        console.log(" Cloudinary image deleted:", publicId);
      }

      // Delete the document from DB
      await SiteInformation.deleteOne({ slug });
      console.log(" SiteInformation document deleted:", slug);
    } catch (error) {
      console.error("❌ Background deletion failed:", error.message);
    }
  })();
});
