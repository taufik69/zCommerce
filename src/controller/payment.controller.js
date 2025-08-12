const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");

// @desc success payment
exports.successPayment = asynchandeler(async (req, res) => {
  apiResponse.sendSuccess(res, 200, "Payment successful", req.body);
});

// @desc fail payment
exports.failPayment = asynchandeler(async (req, res) => {
  apiResponse.sendSuccess(res, 200, "Payment failed", req.body);
});

// @desc cancel payment
exports.cancelPayment = asynchandeler(async (req, res) => {
  apiResponse.sendSuccess(res, 200, "Payment canceled", req.body);
});

// @desc ipn payment
exports.ipnPayment = asynchandeler(async (req, res) => {
  console.log(req.body);
  const { val_id } = req.body;
  if (!val_id) {
    return apiResponse.sendError(res, 400, "Validation ID missing in IPN");
  }

  const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
  const validationResponse = await sslcz.validate({ val_id });

  if (
    validationResponse.status === "VALID" ||
    validationResponse.status === "VALIDATED"
  ) {
    // Order status DB তে confirmed করবে
    return apiResponse.sendSuccess(
      res,
      200,
      "IPN payment verified",
      validationResponse
    );
  } else {
    return apiResponse.sendError(
      res,
      400,
      "IPN payment validation failed",
      validationResponse
    );
  }
});
