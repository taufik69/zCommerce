const multer = require("multer");
const path = require("path");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");

// Allowed file types
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp");
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const filename = path.basename(file.originalname, ext);
    cb(null, `${filename}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    const error = new Error(
      "Only image files (JPG, JPEG, PNG, WEBP) are allowed. GIFs and videos are not accepted.",
    );
    error.statusCode = 400;
    return cb(error, false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 15MB max size
  },
});

/**
 * Middleware wrapper for single file upload with clean error handling
 */
const singleFileUpload = (fieldName) => (req, res, next) => {
  const uploader = upload.single(fieldName);

  uploader(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      console.log("multer error", "Multer error: " + err || "Multer error");
      return next(
        new customError(
          "Multer error: " + err || "Multer error",
          statusCodes.SERVER_ERROR,
        ),
      );
    } else if (err) {
      console.log("Multer error: " + err);
      return next(
        new customError(err || "Multer error", statusCodes.SERVER_ERROR),
      );
    }
    next();
  });
};

/**
 * Middleware wrapper for multiple file upload with clean error handling
 */
const multipleFileUpload =
  (fieldName, maxCount = 1) =>
  (req, res, next) => {
    const uploader = upload.array(fieldName, maxCount);

    uploader(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        // Handle Multer-specific errors
        console.error("Multer multiple error:", err);

        return res.status(400).json({
          success: false,
          message: "Multer error: " + (err.message || "File upload error"),
        });
      } else if (err) {
        // Handle other errors
        console.error("File upload error:", err);
        return res.status(500).json({
          success: false,
          message: err.message || "Internal Server Error",
        });
      }
      next();
    });
  };

// make a another funtion using upload.fields to upload multiple files with different field names
const multipleFileUploadWithFields = (fields) => (req, res, next) => {
  const uploader = upload.fields(fields);
  uploader(req, res, function (err) {
    console.log("multer error from multipleFileUploadWithFields", err);
    if (err instanceof multer.MulterError) {
      return next(
        new customError(
          "Multer error: " + err || "Multer error",
          statusCodes.SERVER_ERROR,
        ),
      );
    } else if (err) {
      console.log("multer error from multipleFileUploadWithFields", err);
      return next(
        new customError(err || "Multer error", statusCodes.SERVER_ERROR),
      );
    }
    next();
  });
};
// Export the middleware functions

module.exports = {
  singleFileUpload,
  multipleFileUpload,
  multipleFileUploadWithFields,
};
