const { customError } = require("../lib/CustomError");
const { apiResponse } = require("../utils/apiResponse");
const { asynchandeler } = require("../lib/asyncHandeler");
const OutletInformation = require("../models/outletInformationModel");
const {
  validateOutletInformation,
} = require("../validation/outlet.validation");

const {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
} = require("../helpers/cloudinary");
const { statusCodes } = require("../constant/constant");

// create outlet information
exports.createOutletInformation = asynchandeler(async (req, res, next) => {
  //  Validate request body
  const validatedData = await validateOutletInformation(req, res, next);

  // Create outlet in DB immediately (without waiting for image upload)
  const outlet = await OutletInformation.create({
    ...validatedData,
    image: null,
  });

  // 3 Send early response to client
  apiResponse.sendSuccess(
    res,
    statusCodes.CREATED,
    "Outlet information saved. Image uploading in background...",
    outlet,
  );

  // 4️Background image upload
  (async () => {
    try {
      if (validatedData.image) {
        const imageUpload = await cloudinaryFileUpload(
          validatedData.image.path,
          "outlets",
        );
        await OutletInformation.findByIdAndUpdate(outlet._id, {
          image: imageUpload.optimizeUrl,
        });
        console.log(`✅ Image uploaded for outlet: ${outlet._id}`);
      } else {
        console.log(`ℹ️ No image file provided for outlet: ${outlet._id}`);
      }
    } catch (error) {
      console.error(
        `❌ Image upload failed for outlet: ${outlet._id}`,
        error.message,
      );
    }
  })();
});

// Get all outlet information
exports.getAllOutletInformation = asynchandeler(async (req, res) => {
  const outlets = await OutletInformation.find({ isActive: true }).sort({
    createdAt: -1,
  });
  if (!outlets) {
    throw new customError("No outlets found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "All outlets fetched successfully",
    outlets,
  );
});

// Get single outlet by slug
exports.getOutletInformationBySlug = asynchandeler(async (req, res) => {
  const { slug } = req.params;
  const outlet = await OutletInformation.findOne({ slug, isActive: true });
  if (!outlet) {
    throw new customError("Outlet not found", statusCodes.NOT_FOUND);
  }
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Outlet fetched successfully",
    outlet,
  );
});

// update outlet information
exports.updateOutletInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  //  Step 1: Find existing outlet
  const outlet = await OutletInformation.findOne({ slug, isActive: true });
  if (!outlet) {
    throw new customError("Outlet not found", statusCodes.NOT_FOUND);
  }

  //  Step 2: Validate request data
  const validatedData = await validateOutletInformation(req, res, next);

  //  Step 3: Send early response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Outlet update request accepted. Processing in background...",
    { slug },
  );

  // Step 4: Background processing
  (async () => {
    try {
      let newImageUrl = outlet.image;

      // --- If new image is uploaded ---
      if (req.file) {
        // Delete old image from Cloudinary
        if (outlet.image) {
          try {
            const parts = outlet.image.split("/");
            const publicId = parts[parts.length - 1].split(".")[0];
            if (publicId) {
              await deleteCloudinaryFile(publicId.split("?")[0]);
              console.log(`🗑️ Old outlet image deleted for: ${outlet._id}`);
            }
          } catch (err) {
            console.warn(
              `⚠️ Failed to delete old image for outlet ${outlet._id}: ${err.message}`,
            );
          }
        }

        // Upload new image
        const uploadResult = await cloudinaryFileUpload(
          req.file.path,
          "outlets",
        );
        if (!uploadResult) {
          throw new customError(
            "New image upload failed",
            statusCodes.SERVER_ERROR,
          );
        }
        newImageUrl = uploadResult.optimizeUrl;
      }

      // Update other fields
      outlet.locationName = validatedData.locationName || outlet.locationName;
      outlet.address = validatedData.address || outlet.address;
      outlet.managerMobile =
        validatedData.managerMobile || outlet.managerMobile;
      outlet.managerName = validatedData.managerName || outlet.managerName;
      outlet.email = validatedData.email || outlet.email;
      outlet.businessHour = validatedData.businessHour || outlet.businessHour;
      outlet.offDay = validatedData.offDay || outlet.offDay;
      outlet.image = newImageUrl;

      await outlet.save();
      console.log(`✅ Outlet successfully updated: ${outlet._id}`);
    } catch (error) {
      console.error(`❌ Background outlet update failed: ${error.message}`);
    }
  })();
});

// delete outlet information
exports.deleteOutletInformation = asynchandeler(async (req, res) => {
  const { slug } = req.params;

  // : Find outlet
  const outlet = await OutletInformation.findOne({ slug, isActive: true });
  if (!outlet) {
    throw new customError("Outlet not found", statusCodes.NOT_FOUND);
  }

  // : Send early response
  apiResponse.sendSuccess(
    res,
    statusCodes.OK,
    "Outlet deletion request accepted",
    {
      slug: outlet.slug,
      id: outlet._id,
    },
  );

  //  Background deletion (fire-and-forget)
  (async () => {
    try {
      // Delete image from Cloudinary if exists
      if (outlet.image) {
        try {
          const parts = outlet.image.split("/");
          const publicId = parts[parts.length - 1].split(".")[0];
          if (publicId) {
            await deleteCloudinaryFile(publicId.split("?")[0]);
            console.log(`🗑️ Outlet image deleted for: ${outlet._id}`);
          }
        } catch (err) {
          console.warn(
            `⚠️ Failed to delete image for outlet ${outlet._id}: ${err.message}`,
          );
        }
      }

      // Delete outlet from DB
      await OutletInformation.deleteOne({ _id: outlet._id });
      console.log(`✅ Outlet deleted successfully: ${outlet._id}`);
    } catch (error) {
      console.error(`❌ Background outlet deletion failed: ${error.message}`);
    }
  })();
});
