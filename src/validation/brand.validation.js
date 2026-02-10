const joi = require("joi");
const { customError } = require("../lib/CustomError");
const { statusCodes } = require("../constant/constant");
const brandSchema = joi.object(
  {
    name: joi.string().trim().required().messages({
      "string.empty": "Name is required.",
      "any.required": "Name is required.",
    }),
  },
  {
    abortEarly: false,
    allowUnknown: true,
  },
);

exports.validateBrand = async (req, res, next) => {
  try {
    const value = await brandSchema.validateAsync(req.body);
    if (!req.files || req.files.length === 0) {
      return next(
        new customError(
          "Please provide at least one image",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    if (req.files[0].fieldname !== "image") {
      return next(
        new customError(
          "Please provide a valid image name fieldName (image)",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    if (req.files[0].size > 5 * 1024 * 1024) {
      return next(
        new customError(
          "Image size should be less than 15MB",
          statusCodes.BAD_REQUEST,
        ),
      );
    }

    if (req.files.length > 1) {
      return next(
        new customError(
          "You can upload a maximum of 1 images",
          statusCodes.BAD_REQUEST,
        ),
      );
    }
    return { ...value, image: req.files[0] };
  } catch (error) {
    console.log("Validation error " + error.details.map((err) => err.message));
    return next(
      new customError(
        "Validation error " + error.details.map((err) => err.message),
        statusCodes.BAD_REQUEST,
      ),
    );
  }
};
