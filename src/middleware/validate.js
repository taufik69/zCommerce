const { statusCodes } = require("../constant/constant");
const { customError } = require("../lib/CustomError");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property]);

    if (error) {
      next(new customError(error.message, statusCodes.BAD_REQUEST));
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
