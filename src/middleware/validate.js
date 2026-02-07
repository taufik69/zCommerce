const { customError } = require("../lib/CustomError");

const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property]);

    if (error) {
      let errors = error.details.map((e) => ({
        field: e.path.join("."),
        message: e.message,
      }));
      next(new customError(errors, 400));
    }

    req[property] = value;
    next();
  };
};

module.exports = validate;
