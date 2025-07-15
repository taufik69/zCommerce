require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const { log } = require("console");
const fs = require("fs");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Uploads a file to Cloudinary
 * @param {string} localFilePath - Path to the local file to upload
 * @returns {Promise<Object|null>} - The upload result or null on failure
 */
const cloudinaryFileUpload = async (localFilePath) => {
  if (!localFilePath || !fs.existsSync(localFilePath)) return null;

  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    // Optimize delivery by resizing and applying auto-format and auto-quality
    const optimizeUrl = cloudinary.url(result.public_id, {
      fetch_format: "auto",
      quality: "auto",
    });

    // Delete local file after upload
    fs.unlinkSync(localFilePath);
    return { result, optimizeUrl };
  } catch (error) {
    console.error("Cloudinary Upload Error:", error.message);

    // Only delete the file if it exists
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }

    return null;
  }
};

/**
 * Deletes a file from Cloudinary by public ID
 * @param {string} publicId - Cloudinary public ID of the file to delete
 * @returns {Promise<Object|null>} - The deletion result or null on failure
 */
const deleteCloudinaryFile = async (publicId) => {
  if (!publicId) return null;

  try {
    const result = await cloudinary.api.delete_resources([publicId], {
      type: "upload",
      resource_type: "image",
    });
    console.log("Cloudinary Delete Result:", result);

    return result;
  } catch (error) {
    console.error("Cloudinary Delete Error:", error.message);
    return null;
  }
};

// uplload barcode to cloudinary
const uploadBarcodeToCloudinary = async (barcodeBase64) => {
  if (!barcodeBase64) return null;

  try {
    const result = await cloudinary.uploader.upload(barcodeBase64, {
      resource_type: "image",
      folder: "barcodes",
      format: "png",
    });

    // Optimize delivery by resizing and applying auto-format and auto-quality
    const optimizeUrl = cloudinary.url(result.public_id, {
      fetch_format: "auto",
      quality: "auto",
    });

    return { result, optimizeUrl };
  } catch (error) {
    console.error("Cloudinary Barcode Upload Error:", error.message);
    return null;
  }
};
module.exports = {
  cloudinaryFileUpload,
  deleteCloudinaryFile,
  uploadBarcodeToCloudinary,
};
