const DeliveryCharge = require("../models/delivery.model");
const { customError } = require("../lib/CustomError");
const { asynchandeler } = require("../lib/asyncHandeler");
const { apiResponse } = require("../utils/apiResponse");

exports.createDeliveryCharge = asynchandeler(async (req, res) => {
  const { name, deliveryCharge, description } = req.body;

  if (!name || !deliveryCharge) {
    throw new customError("Name and delivery charge are required", 400);
  }

  const newDelivery = new DeliveryCharge({
    name,
    deliveryCharge,
    description,
  });

  await newDelivery.save();

  return apiResponse.sendSuccess(
    res,
    201,
    "Delivery charge created successfully",
    newDelivery
  );
});

//@desc getDeliveryCharge
exports.getDeliveryCharge = asynchandeler(async (req, res) => {
  const deliveryCharges = await DeliveryCharge.find();

  if (!deliveryCharges.length) {
    return apiResponse.sendSuccess(res, 200, "No delivery charges found", []);
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Delivery charges retrieved successfully",
    deliveryCharges
  );
});
//@desc getsingle deliveryCharge by id
exports.getSingleDeliveryCharge = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const deliveryCharge = await DeliveryCharge.findById(id);
  if (!deliveryCharge) {
    throw new customError("Delivery charge not found", 404);
  }
  return apiResponse.sendSuccess(
    res,
    200,
    "Delivery charge retrieved successfully",
    deliveryCharge
  );
});

//@desc updateDeliveryCharge
exports.updateDeliveryCharge = asynchandeler(async (req, res) => {
  const { id } = req.params;

  const updatedDelivery = await DeliveryCharge.findOneAndUpdate(
    { _id: id },
    req.body,
    { new: true }
  );

  if (!updatedDelivery) {
    throw new customError("Delivery charge not found", 404);
  }

  return apiResponse.sendSuccess(
    res,
    200,
    "Delivery charge updated successfully",
    updatedDelivery
  );
});

// @desc deleteDeliveryCharge
exports.deleteDeliveryCharge = asynchandeler(async (req, res) => {
  const { id } = req.params;
  const deletedDelivery = await DeliveryCharge.findOneAndDelete({ _id: id });
  if (!deletedDelivery) {
    throw new customError("Delivery charge not found", 404);
  }
  return apiResponse.sendSuccess(
    res,
    200,
    "Delivery charge deleted successfully",
    deletedDelivery
  );
});
