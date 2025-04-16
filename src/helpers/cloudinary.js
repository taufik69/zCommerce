require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const fs = require("fs");
const path = require("path");

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
      public_id: "taufik",
    });

    // Optimize delivery by resizing and applying auto-format and auto-quality
    const optimizeUrl = cloudinary.url("taufik", {
      fetch_format: "auto",
      quality: "auto",
    });

    console.log("Cloudinary URL:", optimizeUrl);

    // Delete local file after upload
    fs.unlinkSync(localFilePath);
    return result;
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
    });

    return result;
  } catch (error) {
    console.error("Cloudinary Delete Error:", error.message);
    return null;
  }
};

module.exports = { cloudinaryFileUpload, deleteCloudinaryFile };
